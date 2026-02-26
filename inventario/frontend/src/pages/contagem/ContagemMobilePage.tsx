import { useState, useCallback, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { inventoryService } from '../../services/inventory.service';
import { ScannerInput } from './components/ScannerInput';
import { CountingProgress } from './components/CountingProgress';
import { useCountingData } from './hooks/useCountingData';
import { ArrowLeft, ChevronLeft, ChevronRight, Check, Loader2 } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';

export function ContagemMobilePage() {
  const { inventoryId } = useParams<{ inventoryId: string }>();
  const navigate = useNavigate();
  const { inventario, allProducts, loading, stats, updateProduct } = useCountingData(inventoryId!);
  const toast = useToast();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [quantity, setQuantity] = useState('');
  const [observation, setObservation] = useState('');
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const products = allProducts; // Mobile shows all products, no filter
  const currentProduct = products[currentIndex] || null;

  // Focus input when product changes
  useEffect(() => {
    if (currentProduct && inputRef.current) {
      // Pre-fill if already counted
      if (currentProduct.count_cycle_1 !== null) {
        setQuantity(String(currentProduct.count_cycle_1));
      } else {
        setQuantity('');
      }
      setObservation('');
      inputRef.current.focus();
    }
  }, [currentIndex, currentProduct]);

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

  // Save count
  const handleSave = useCallback(async () => {
    if (!currentProduct) return;
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
        count_cycle_1: qty,
        status: 'COUNTED',
      });

      // Flash verde de sucesso
      setFlash(true);
      setTimeout(() => setFlash(false), 500);

      // Avanca para proximo pendente
      const nextPendingIdx = products.findIndex((p, i) => i > currentIndex && p.status === 'PENDING');
      if (nextPendingIdx >= 0) {
        setCurrentIndex(nextPendingIdx);
      } else if (currentIndex < products.length - 1) {
        setCurrentIndex(currentIndex + 1);
      }
    } catch {
      toast.error('Erro ao salvar contagem.');
    } finally {
      setSaving(false);
    }
  }, [currentProduct, quantity, observation, currentIndex, products, updateProduct]);

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

  return (
    <div className={`min-h-screen flex flex-col transition-colors ${flash ? 'bg-green-100' : 'bg-slate-50'}`}>
      {/* Header fino */}
      <div className="bg-capul-600 text-white px-4 py-3 flex items-center justify-between shrink-0">
        <button onClick={() => navigate('/inventario/contagem')} className="p-1">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <span className="font-medium text-sm truncate mx-2">
          {inventario?.name || 'Contagem'}
        </span>
        <span className="text-xs bg-white/20 px-2 py-0.5 rounded">
          {inventario?.warehouse || ''}
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
              <p className="text-xs text-slate-400">Codigo</p>
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
              {/* Contagem cega: NAO mostrar saldo sistema */}
            </div>

            {/* Status atual */}
            {currentProduct.count_cycle_1 !== null && (
              <div className="p-2 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
                <Check className="w-4 h-4 text-green-600" />
                <span className="text-sm text-green-700">
                  Ja contado: {currentProduct.count_cycle_1.toFixed(2)}
                </span>
              </div>
            )}

            {/* Input quantidade */}
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
    </div>
  );
}
