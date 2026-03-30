import { useState, useCallback, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { inventoryService } from '../../services/inventory.service';
import { ScannerInput } from './components/ScannerInput';
import { CountingProgress } from './components/CountingProgress';
import { LoteContagemModal } from './components/LoteContagemModal';
import { useCountingData } from './hooks/useCountingData';
import { ArrowLeft, ChevronLeft, ChevronRight, Check, Loader2, Layers } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import type { LotCount } from '../../types';

const cycleColors = ['', 'bg-green-600', 'bg-amber-600', 'bg-red-600'];

export function ContagemMobilePage() {
  const { inventoryId } = useParams<{ inventoryId: string }>();
  const navigate = useNavigate();
  const {
    inventario, allProducts, loading, stats,
    currentCycle, getCountedQty, countCycleKey, updateProduct,
    noAssignedList, listNotReleased,
  } = useCountingData(inventoryId!);
  const toast = useToast();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [quantity, setQuantity] = useState('');
  const [observation, setObservation] = useState('');
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState(false);
  const [showLotModal, setShowLotModal] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const products = allProducts; // Mobile shows all products, no filter
  const currentProduct = products[currentIndex] || null;
  const isLotProduct = currentProduct?.requires_lot || currentProduct?.has_lot;

  // Focus input when product changes
  useEffect(() => {
    if (currentProduct && inputRef.current && !isLotProduct) {
      const counted = getCountedQty(currentProduct);
      if (counted !== null) {
        setQuantity(String(counted));
      } else {
        setQuantity('');
      }
      setObservation('');
      inputRef.current.focus();
    }
    if (currentProduct && isLotProduct) {
      const counted = getCountedQty(currentProduct);
      if (counted !== null) {
        setQuantity(String(counted));
      } else {
        setQuantity('');
      }
    }
  }, [currentIndex, currentProduct, getCountedQty, isLotProduct]);

  // Scanner: find product and navigate to it
  const handleScan = useCallback((code: string) => {
    const idx = products.findIndex(
      (p) => p.product_code.toUpperCase() === code.toUpperCase()
        || p.product_code.toUpperCase().endsWith(code.toUpperCase()),
    );
    if (idx >= 0) {
      setCurrentIndex(idx);
    } else {
      toast.warning(`Produto "${code}" nao encontrado.`);
    }
  }, [products]);

  // Advance to next pending after save
  function advanceToNext() {
    const nextPendingIdx = products.findIndex(
      (p, i) => i > currentIndex && (p.status === 'PENDING' || p.status === 'pending'),
    );
    if (nextPendingIdx >= 0) {
      setCurrentIndex(nextPendingIdx);
    } else if (currentIndex < products.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  }

  // Save count (cycle-aware) — for non-lot products
  const handleSave = useCallback(async () => {
    if (!currentProduct) return;

    // For lot products, open the lot modal instead
    if (isLotProduct) {
      setShowLotModal(true);
      return;
    }

    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty < 0) {
      toast.warning('Informe uma quantidade valida.');
      return;
    }

    setSaving(true);
    try {
      await inventoryService.registrarContagem(currentProduct.id, {
        quantity: qty,
        observation: observation.trim() || undefined,
      });
      updateProduct(currentProduct.id, {
        [countCycleKey]: qty,
        status: 'COUNTED',
      } as Record<string, unknown>);

      setFlash(true);
      setTimeout(() => setFlash(false), 500);
      advanceToNext();
    } catch {
      toast.error('Erro ao salvar contagem.');
    } finally {
      setSaving(false);
    }
  }, [currentProduct, quantity, observation, currentIndex, products, updateProduct, countCycleKey, isLotProduct]);

  // Save lot-based count
  const handleSaveLotCount = useCallback(async (totalQty: number, lotCounts: LotCount[]) => {
    if (!currentProduct) return;
    await inventoryService.registrarContagem(currentProduct.id, {
      quantity: totalQty,
      lot_counts: lotCounts,
    });
    updateProduct(currentProduct.id, {
      [countCycleKey]: totalQty,
      status: 'COUNTED',
    } as Record<string, unknown>);
    setShowLotModal(false);
    setFlash(true);
    setTimeout(() => setFlash(false), 500);
    toast.success(`Contagem por lote salva — ${lotCounts.length} lote(s).`);
    advanceToNext();
  }, [currentProduct, updateProduct, countCycleKey, currentIndex, products]);

  function handleClear() {
    setQuantity('');
    setObservation('');
    inputRef.current?.focus();
  }

  function handlePrev() {
    if (currentIndex > 0) setCurrentIndex(currentIndex - 1);
  }

  function handleNext() {
    if (currentIndex < products.length - 1) setCurrentIndex(currentIndex + 1);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      handleSave();
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-capul-500 animate-spin" />
      </div>
    );
  }

  if (noAssignedList || listNotReleased) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <div className="bg-capul-600 text-white px-4 py-3 flex items-center shrink-0">
          <button onClick={() => navigate('/inventario/contagem')} className="p-1">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <span className="font-medium text-sm ml-2">Contagem</span>
        </div>
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center">
            {listNotReleased ? (
              <>
                <p className="text-slate-600 font-medium">Lista ainda nao liberada</p>
                <p className="text-sm text-slate-400 mt-1">A lista precisa ser liberada antes de iniciar a contagem.</p>
              </>
            ) : (
              <>
                <p className="text-slate-600 font-medium">Nenhuma lista atribuida a voce</p>
                <p className="text-sm text-slate-400 mt-1">Voce nao e contador de nenhuma lista neste inventario.</p>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  const countedQty = currentProduct ? getCountedQty(currentProduct) : null;

  return (
    <div className={`min-h-screen flex flex-col transition-colors ${flash ? 'bg-green-100' : 'bg-slate-50'}`}>
      {/* Header fino */}
      <div className={`${cycleColors[currentCycle] || 'bg-capul-600'} text-white px-4 py-3 flex items-center justify-between shrink-0`}>
        <button onClick={() => navigate('/inventario/contagem')} className="p-1">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <span className="font-medium text-sm truncate mx-2">
          {inventario?.name || 'Contagem'}
        </span>
        <span className="text-xs bg-white/20 px-2 py-0.5 rounded font-bold">
          {currentCycle}o Ciclo
        </span>
      </div>

      {/* Progresso */}
      <div className="px-4 py-2 bg-white border-b border-slate-200 shrink-0">
        <CountingProgress
          total={stats.total}
          counted={stats.counted}
          compact
        />
      </div>

      {/* Scanner */}
      <div className="px-4 py-3 bg-white border-b border-slate-100 shrink-0">
        <ScannerInput onScan={handleScan} size="large" autoFocus={false} />
      </div>

      {/* Card do produto */}
      <div className="flex-1 p-4 flex items-center justify-center">
        {!currentProduct ? (
          <div className="text-center text-slate-500">
            <p>Nenhum produto para contar.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm w-full max-w-md p-5 space-y-4">
            {/* Info do produto */}
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <p className="text-xs text-slate-400">Codigo</p>
                {isLotProduct && (
                  <span className="flex items-center gap-1 px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-[10px] font-medium">
                    <Layers className="w-3 h-3" />
                    Lote
                  </span>
                )}
              </div>
              <p className="text-lg font-mono font-bold text-slate-800">{currentProduct.product_code}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Descricao</p>
              <p className="text-base text-slate-700">{currentProduct.product_description || currentProduct.product_name}</p>
            </div>
            <div className="flex gap-4">
              <div>
                <p className="text-xs text-slate-400">Armazem</p>
                <p className="text-sm font-medium text-slate-700">{currentProduct.warehouse}</p>
              </div>
              {currentProduct.location && (
                <div>
                  <p className="text-xs text-slate-400">Localizacao</p>
                  <p className="text-sm font-medium font-mono text-slate-700">{currentProduct.location}</p>
                </div>
              )}
              {/* Contagem cega: NAO mostrar saldo sistema */}
            </div>

            {/* Hint: entrega posterior */}
            {(currentProduct.b2_xentpos || 0) > 0.001 && (
              <div className="p-2 bg-sky-50 border border-sky-200 rounded-lg text-xs text-sky-700">
                Este produto possui entregas posteriores.
              </div>
            )}

            {/* Contagens de ciclos anteriores (sem revelar saldo) */}
            {currentCycle >= 2 && currentProduct.count_cycle_1 !== null && (
              <div className="p-2 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
                C1: {currentProduct.count_cycle_1.toFixed(2)}
              </div>
            )}
            {currentCycle >= 3 && currentProduct.count_cycle_2 !== null && (
              <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
                C2: {currentProduct.count_cycle_2.toFixed(2)}
              </div>
            )}

            {/* Status atual */}
            {countedQty !== null && (
              <div className="p-2 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-2">
                <Check className="w-4 h-4 text-blue-600" />
                <span className="text-sm text-blue-700">
                  Ja contado (C{currentCycle}): {countedQty.toFixed(2)}
                </span>
              </div>
            )}

            {/* Input quantidade — only for non-lot products */}
            {isLotProduct ? (
              <div>
                <button
                  onClick={() => setShowLotModal(true)}
                  disabled={saving}
                  className="w-full py-4 bg-purple-600 text-white rounded-lg text-base font-bold hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Layers className="w-5 h-5" />
                  {countedQty !== null ? `Recontar por Lote (${countedQty.toFixed(2)})` : 'Contar por Lote'}
                </button>
              </div>
            ) : (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Quantidade</label>
                  <input
                    ref={inputRef}
                    type="number"
                    inputMode="decimal"
                    step="any"
                    min="0"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="0"
                    className="w-full border border-slate-300 rounded-lg px-4 py-4 text-2xl text-center font-bold focus:outline-none focus:ring-2 focus:ring-capul-500"
                  />
                </div>

                {/* Observacao */}
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Observacao (opcional)</label>
                  <input
                    type="text"
                    value={observation}
                    onChange={(e) => setObservation(e.target.value)}
                    placeholder="Obs..."
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-capul-500"
                  />
                </div>

                {/* Botoes */}
                <div className="flex gap-3">
                  <button
                    onClick={handleClear}
                    className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-200"
                  >
                    Limpar
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving || !quantity}
                    className="flex-1 py-3 bg-capul-600 text-white rounded-lg text-sm font-medium hover:bg-capul-700 disabled:opacity-50"
                  >
                    {saving ? 'Salvando...' : 'Salvar'}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Navegacao */}
      <div className="px-4 py-3 bg-white border-t border-slate-200 flex items-center justify-between shrink-0">
        <button
          onClick={handlePrev}
          disabled={currentIndex <= 0}
          className="flex items-center gap-1 px-4 py-3 bg-slate-100 text-slate-600 rounded-lg text-sm font-medium disabled:opacity-40"
        >
          <ChevronLeft className="w-4 h-4" />
          Anterior
        </button>
        <span className="text-sm text-slate-500">
          {products.length > 0 ? `${currentIndex + 1} de ${products.length}` : '0 de 0'}
        </span>
        <button
          onClick={handleNext}
          disabled={currentIndex >= products.length - 1}
          className="flex items-center gap-1 px-4 py-3 bg-capul-600 text-white rounded-lg text-sm font-medium disabled:opacity-40"
        >
          Proximo
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Status bar */}
      <div className="px-4 py-2 bg-slate-100 border-t border-slate-200 flex items-center justify-center gap-6 text-xs text-slate-500 shrink-0">
        <span>Pendentes: <strong className="text-amber-600">{stats.pending}</strong></span>
        <span>Contados: <strong className="text-green-600">{stats.counted}</strong></span>
        {stats.divergent > 0 && <span>Diverg.: <strong className="text-red-600">{stats.divergent}</strong></span>}
      </div>

      {/* Modal de contagem por lote */}
      {showLotModal && currentProduct && (
        <LoteContagemModal
          product={currentProduct}
          currentCycle={currentCycle}
          onSave={handleSaveLotCount}
          onClose={() => setShowLotModal(false)}
        />
      )}
    </div>
  );
}
