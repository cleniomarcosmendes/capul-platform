import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Loader2, Package, Save } from 'lucide-react';
import { inventoryService } from '../../../services/inventory.service';
import type { CountingListProduct, LotCount } from '../../../types';

interface LotRow {
  lot_number: string;
  b8_lotefor: string;
  system_qty: number;
  counted_qty: string; // string for input control
}

interface Props {
  product: CountingListProduct;
  currentCycle: number;
  onSave: (totalQty: number, lotCounts: LotCount[]) => Promise<void>;
  onClose: () => void;
}

export function LoteContagemModal({ product, currentCycle, onSave, onClose }: Props) {
  const [lots, setLots] = useState<LotRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [observation, setObservation] = useState('');
  const firstInputRef = useRef<HTMLInputElement>(null);

  // Load lot snapshot
  useEffect(() => {
    setLoading(true);
    setError('');
    inventoryService.buscarLotesSnapshot(product.id)
      .then((res) => {
        if (res.has_lots && res.lots.length > 0) {
          // Check if product already has saved lot data (from snapshot_lots)
          const savedLots = product.snapshot_lots || [];
          const savedMap = new Map(savedLots.map((l) => [l.lot_number, l.counted_qty]));

          setLots(res.lots.map((l) => ({
            lot_number: l.lot_number,
            b8_lotefor: l.b8_lotefor || '',
            system_qty: l.system_qty,
            counted_qty: savedMap.get(l.lot_number) !== null && savedMap.get(l.lot_number) !== undefined
              ? String(savedMap.get(l.lot_number))
              : '',
          })));
        } else {
          setError('Produto sem lote valido na data do inventario. Todos os lotes possuem data de vencimento anterior a data de referencia.');
        }
      })
      .catch(() => setError('Erro ao carregar lotes do produto.'))
      .finally(() => setLoading(false));
  }, [product.id, product.snapshot_lots]);

  // Focus first input when loaded
  useEffect(() => {
    if (!loading && lots.length > 0 && firstInputRef.current) {
      firstInputRef.current.focus();
    }
  }, [loading, lots.length]);

  const updateLotQty = useCallback((index: number, value: string) => {
    setLots((prev) => prev.map((l, i) => i === index ? { ...l, counted_qty: value } : l));
  }, []);

  const totalContado = lots.reduce((sum, l) => {
    const v = parseFloat(l.counted_qty);
    return sum + (isNaN(v) ? 0 : v);
  }, 0);

  const totalSistema = lots.reduce((sum, l) => sum + l.system_qty, 0);
  const diff = totalContado - totalSistema;
  const allFilled = lots.every((l) => l.counted_qty.trim() !== '' && !isNaN(parseFloat(l.counted_qty)));

  async function handleSave() {
    if (!allFilled) return;
    setSaving(true);
    try {
      const lotCounts: LotCount[] = lots.map((l) => ({
        lot_number: l.lot_number,
        quantity: parseFloat(l.counted_qty),
      }));
      await onSave(totalContado, lotCounts);
    } catch {
      setError('Erro ao salvar contagem.');
    } finally {
      setSaving(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent, index: number) {
    if (e.key === 'Enter') {
      e.preventDefault();
      // Move to next input or save
      if (index < lots.length - 1) {
        const nextInput = document.querySelector<HTMLInputElement>(`[data-lot-index="${index + 1}"]`);
        nextInput?.focus();
      } else if (allFilled) {
        handleSave();
      }
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 shrink-0">
          <div>
            <h3 className="text-base font-semibold text-slate-800">Contagem por Lote</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              <span className="font-mono">{product.product_code}</span>
              {' — '}
              {product.product_description || product.product_name}
              {' — '}
              <span className="font-medium">{currentCycle}o Ciclo</span>
            </p>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-5">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-capul-500 animate-spin" />
              <span className="ml-2 text-sm text-slate-500">Carregando lotes...</span>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <Package className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-500">{error}</p>
            </div>
          ) : (
            <>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left py-2 px-3 font-medium text-slate-600">Lote</th>
                    <th className="text-left py-2 px-3 font-medium text-slate-500 text-xs">Lote Forn.</th>
                    <th className="text-right py-2 px-3 font-medium text-slate-600">Saldo Sistema</th>
                    <th className="text-right py-2 px-3 font-medium text-capul-700">Qtd Contada</th>
                    <th className="text-right py-2 px-3 font-medium text-slate-600 w-20">Dif.</th>
                  </tr>
                </thead>
                <tbody>
                  {lots.map((lot, idx) => {
                    const counted = parseFloat(lot.counted_qty);
                    const lotDiff = !isNaN(counted) ? counted - lot.system_qty : null;
                    return (
                      <tr key={lot.lot_number} className="border-b border-slate-100">
                        <td className="py-2 px-3 font-mono text-xs text-slate-700">{lot.lot_number}</td>
                        <td className="py-2 px-3 text-xs text-slate-400">{lot.b8_lotefor || '—'}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-slate-600">{lot.system_qty.toFixed(2)}</td>
                        <td className="py-2 px-3 text-right">
                          <input
                            ref={idx === 0 ? firstInputRef : undefined}
                            data-lot-index={idx}
                            type="number"
                            inputMode="decimal"
                            step="any"
                            min="0"
                            value={lot.counted_qty}
                            onChange={(e) => updateLotQty(idx, e.target.value)}
                            onKeyDown={(e) => handleKeyDown(e, idx)}
                            placeholder="0"
                            className="w-28 text-right border border-slate-300 rounded-lg px-3 py-1.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-capul-500"
                          />
                        </td>
                        <td className={`py-2 px-3 text-right text-xs font-medium tabular-nums ${
                          lotDiff !== null && lotDiff > 0 ? 'text-green-600' : lotDiff !== null && lotDiff < 0 ? 'text-red-600' : 'text-slate-400'
                        }`}>
                          {lotDiff !== null ? (
                            <>{lotDiff > 0 ? '+' : ''}{lotDiff.toFixed(2)}</>
                          ) : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 border-t-2 border-slate-300">
                    <td colSpan={2} className="py-2.5 px-3 font-semibold text-slate-700">
                      Total ({lots.length} lote{lots.length !== 1 ? 's' : ''})
                    </td>
                    <td className="py-2.5 px-3 text-right font-semibold tabular-nums text-slate-700">{totalSistema.toFixed(2)}</td>
                    <td className="py-2.5 px-3 text-right font-bold tabular-nums text-capul-700 text-lg">{totalContado.toFixed(2)}</td>
                    <td className={`py-2.5 px-3 text-right font-semibold tabular-nums ${
                      diff > 0 ? 'text-green-600' : diff < 0 ? 'text-red-600' : 'text-slate-400'
                    }`}>
                      {diff !== 0 ? (
                        <>{diff > 0 ? '+' : ''}{diff.toFixed(2)}</>
                      ) : '0.00'}
                    </td>
                  </tr>
                </tfoot>
              </table>

              {/* Observacao */}
              <div className="mt-4">
                <label className="block text-xs text-slate-500 mb-1">Observacao (opcional)</label>
                <input
                  type="text"
                  value={observation}
                  onChange={(e) => setObservation(e.target.value)}
                  placeholder="Obs..."
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-capul-500"
                />
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-slate-200 shrink-0">
          <p className="text-xs text-slate-500">
            {allFilled
              ? <span className="text-green-600 font-medium">Todos os lotes preenchidos</span>
              : <span className="text-amber-600">Preencha todos os lotes para salvar</span>}
          </p>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={!allFilled || saving}
              className="flex items-center gap-1.5 px-4 py-2 text-sm bg-capul-600 text-white rounded-lg hover:bg-capul-700 disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {saving ? 'Salvando...' : `Salvar (${totalContado.toFixed(2)})`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
