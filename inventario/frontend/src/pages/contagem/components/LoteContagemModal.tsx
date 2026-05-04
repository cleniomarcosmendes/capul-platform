import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { X, Loader2, Package, Save, CheckCircle2, Info } from 'lucide-react';
import { inventoryService } from '../../../services/inventory.service';
import { ConfirmDialog } from '../../../components/ConfirmDialog';
import type { CountingListProduct, LotCount } from '../../../types';

interface LotRow {
  lot_number: string;
  b8_lotefor: string;
  system_qty: number;
  counted_qty: string;
  prefilled: boolean;
  prefilledValue: number;
}

interface Props {
  product: CountingListProduct;
  currentCycle: number;
  showPreviousCounts?: boolean;
  onSave: (totalQty: number, lotCounts: LotCount[]) => Promise<void>;
  onClose: () => void;
}

export function LoteContagemModal({ product, currentCycle, showPreviousCounts = false, onSave, onClose }: Props) {
  const [lots, setLots] = useState<LotRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [observation, setObservation] = useState('');
  const [confirmEdit, setConfirmEdit] = useState<{ lotIndex: number; newValue: string } | null>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);

  const previousCycleCounts = useMemo(() => {
    const map = new Map<string, number>();
    // Sem permissão de visualizar contagens anteriores → contagem cega total no lote
    if (!showPreviousCounts) return map;
    if (currentCycle <= 1) return map;
    const prevCycle = currentCycle - 1;
    for (const c of product.countings ?? []) {
      if (c.count_number === prevCycle && c.lot_number) {
        map.set(c.lot_number, c.quantity);
      }
    }
    return map;
  }, [currentCycle, product.countings, showPreviousCounts]);

  // Recontagens já feitas no ciclo ATUAL (em caso de reabrir o modal após salvar)
  const currentCycleCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of product.countings ?? []) {
      if (c.count_number === currentCycle && c.lot_number) {
        map.set(c.lot_number, c.quantity);
      }
    }
    return map;
  }, [currentCycle, product.countings]);

  useEffect(() => {
    setLoading(true);
    setError('');
    inventoryService.buscarLotesSnapshot(product.id)
      .then((res) => {
        if (res.has_lots && res.lots.length > 0) {
          const savedLots = product.snapshot_lots || [];
          const savedMap = new Map(savedLots.map((l) => [l.lot_number, l.counted_qty]));

          setLots(res.lots.map((l) => {
            // Pri 1: recontagem deste ciclo (modal reaberto após salvar)
            if (currentCycleCounts.has(l.lot_number)) {
              const qty = currentCycleCounts.get(l.lot_number)!;
              return {
                lot_number: l.lot_number,
                b8_lotefor: l.b8_lotefor || '',
                system_qty: l.system_qty,
                counted_qty: String(qty),
                prefilled: false,
                prefilledValue: 0,
              };
            }

            const savedQty = savedMap.get(l.lot_number);
            if (savedQty !== null && savedQty !== undefined) {
              return {
                lot_number: l.lot_number,
                b8_lotefor: l.b8_lotefor || '',
                system_qty: l.system_qty,
                counted_qty: String(savedQty),
                prefilled: false,
                prefilledValue: 0,
              };
            }

            if (currentCycle > 1 && previousCycleCounts.has(l.lot_number)) {
              const prevQty = previousCycleCounts.get(l.lot_number)!;
              const matched = Math.abs(prevQty - l.system_qty) <= 0.01;

              if (matched) {
                return {
                  lot_number: l.lot_number,
                  b8_lotefor: l.b8_lotefor || '',
                  system_qty: l.system_qty,
                  counted_qty: String(prevQty),
                  prefilled: true,
                  prefilledValue: prevQty,
                };
              }
              return {
                lot_number: l.lot_number,
                b8_lotefor: l.b8_lotefor || '',
                system_qty: l.system_qty,
                counted_qty: '',
                prefilled: false,
                prefilledValue: 0,
              };
            }

            return {
              lot_number: l.lot_number,
              b8_lotefor: l.b8_lotefor || '',
              system_qty: l.system_qty,
              counted_qty: '',
              prefilled: false,
              prefilledValue: 0,
            };
          }));
        } else {
          setError('Produto sem lote valido na data do inventario. Todos os lotes possuem data de vencimento anterior a data de referencia.');
        }
      })
      .catch(() => setError('Erro ao carregar lotes do produto.'))
      .finally(() => setLoading(false));
  }, [product.id, product.snapshot_lots, currentCycle, previousCycleCounts, currentCycleCounts]);

  useEffect(() => {
    if (!loading && lots.length > 0) {
      const firstEmptyIdx = lots.findIndex((l) => !l.prefilled && l.counted_qty === '');
      if (firstEmptyIdx >= 0) {
        const el = document.querySelector<HTMLInputElement>(`[data-lot-index="${firstEmptyIdx}"]`);
        el?.focus();
      } else if (firstInputRef.current) {
        firstInputRef.current.focus();
      }
    }
  }, [loading, lots.length]);

  const updateLotQty = useCallback((index: number, value: string) => {
    setLots((prev) => {
      const lot = prev[index];
      if (lot.prefilled && value !== String(lot.prefilledValue)) {
        setConfirmEdit({ lotIndex: index, newValue: value });
        return prev;
      }
      return prev.map((l, i) => i === index ? { ...l, counted_qty: value } : l);
    });
  }, []);

  function handleConfirmEdit() {
    if (!confirmEdit) return;
    const { lotIndex, newValue } = confirmEdit;
    setLots((prev) => prev.map((l, i) =>
      i === lotIndex ? { ...l, counted_qty: newValue, prefilled: false } : l
    ));
    setConfirmEdit(null);
    setTimeout(() => {
      const el = document.querySelector<HTMLInputElement>(`[data-lot-index="${lotIndex}"]`);
      el?.focus();
    }, 50);
  }

  function handleCancelEdit() {
    setConfirmEdit(null);
  }

  const totalContado = lots.reduce((sum, l) => {
    const v = parseFloat(l.counted_qty);
    return sum + (isNaN(v) ? 0 : v);
  }, 0);

  const totalSistema = lots.reduce((sum, l) => sum + l.system_qty, 0);
  const diff = totalContado - totalSistema;
  const allFilled = lots.every((l) => l.counted_qty.trim() !== '' && !isNaN(parseFloat(l.counted_qty)));
  const prefilledCount = lots.filter((l) => l.prefilled).length;

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
      if (index < lots.length - 1) {
        const nextInput = document.querySelector<HTMLInputElement>(`[data-lot-index="${index + 1}"]`);
        nextInput?.focus();
      } else if (allFilled) {
        handleSave();
      }
    }
  }

  function formatDiff(value: number | null) {
    if (value === null) return '—';
    if (value === 0) return '0.00';
    return `${value > 0 ? '+' : ''}${value.toFixed(2)}`;
  }

  function diffColor(value: number | null) {
    if (value === null) return 'text-slate-400';
    if (value > 0) return 'text-green-600';
    if (value < 0) return 'text-red-600';
    return 'text-slate-400';
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40">
      <div className="bg-white sm:rounded-xl rounded-t-xl shadow-xl w-full sm:max-w-2xl sm:mx-4 max-h-[95vh] sm:max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between px-4 py-3 border-b border-slate-200 shrink-0">
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-slate-800">Contagem por Lote</h3>
            <p className="text-xs text-slate-500 mt-0.5 truncate">
              <span className="font-mono">{product.product_code}</span>
              {' — '}
              {product.product_description || product.product_name}
            </p>
            <p className="text-xs text-capul-700 font-medium">{currentCycle}o Ciclo</p>
            {currentCycle > 1 && prefilledCount > 0 && (
              <p className="flex items-center gap-1 text-[11px] text-blue-600 mt-1">
                <Info className="w-3 h-3 shrink-0" />
                {prefilledCount} lote(s) conferido(s) no {currentCycle - 1}o ciclo pre-preenchido(s).
              </p>
            )}
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 shrink-0 ml-2">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto px-4 py-3">
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
              {/* Cards mobile */}
              <div className="space-y-3">
                {lots.map((lot, idx) => {
                  const counted = parseFloat(lot.counted_qty);
                  const lotDiff = !isNaN(counted) ? counted - lot.system_qty : null;
                  return (
                    <div
                      key={lot.lot_number}
                      className={`border rounded-lg p-3 ${
                        lot.prefilled ? 'border-green-300 bg-green-50/50' : 'border-slate-200'
                      }`}
                    >
                      {/* Lote info */}
                      <div className="flex items-center justify-between mb-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-mono text-slate-700 truncate">{lot.lot_number}</span>
                            {lot.prefilled && (
                              <span className="inline-flex items-center gap-0.5 text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full shrink-0">
                                <CheckCircle2 className="w-2.5 h-2.5" />
                                Conf. C{currentCycle - 1}
                              </span>
                            )}
                          </div>
                          {lot.b8_lotefor && (
                            <span className="text-[11px] text-slate-400">Forn: {lot.b8_lotefor}</span>
                          )}
                        </div>
                        <span className={`text-sm font-semibold tabular-nums ${diffColor(lotDiff)}`}>
                          {formatDiff(lotDiff)}
                        </span>
                      </div>

                      {/* Saldo + Input */}
                      <div className="flex items-center gap-3">
                        <div className="flex-1">
                          <span className="text-[11px] text-slate-500">Saldo Sistema</span>
                          <p className="text-sm font-medium tabular-nums text-slate-700">{lot.system_qty.toFixed(2)}</p>
                        </div>
                        <div className="flex-1">
                          <span className="text-[11px] text-capul-700 font-medium">Qtd Contada</span>
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
                            className={`w-full text-right border rounded-lg px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 ${
                              lot.prefilled
                                ? 'border-green-400 bg-green-50 focus:ring-green-500'
                                : 'border-slate-300 focus:ring-capul-500'
                            }`}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Total */}
              <div className="mt-3 border-t-2 border-slate-300 pt-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-700">
                    Total ({lots.length} lote{lots.length !== 1 ? 's' : ''})
                  </span>
                  <span className={`text-sm font-semibold tabular-nums ${diffColor(diff)}`}>
                    Dif: {formatDiff(diff)}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <div>
                    <span className="text-[11px] text-slate-500">Sistema</span>
                    <p className="text-sm tabular-nums text-slate-600">{totalSistema.toFixed(2)}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] text-capul-700">Contado</span>
                    <p className="text-lg font-bold tabular-nums text-capul-700">{totalContado.toFixed(2)}</p>
                  </div>
                </div>
              </div>

              {/* Observacao */}
              <div className="mt-3">
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
        <div className="px-4 py-3 border-t border-slate-200 shrink-0">
          {!allFilled && (
            <p className="text-xs text-amber-600 mb-2">Preencha todos os lotes para salvar</p>
          )}
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={!allFilled || saving}
              className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm bg-capul-600 text-white rounded-lg hover:bg-capul-700 disabled:opacity-50"
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

      <ConfirmDialog
        open={confirmEdit !== null}
        title="Alterar lote ja conferido"
        description={`Este lote ja foi conferido e bateu com o sistema no ${currentCycle - 1}o ciclo. Deseja realmente alterar a quantidade?`}
        variant="warning"
        confirmLabel="Sim, alterar"
        cancelLabel="Manter valor"
        onConfirm={handleConfirmEdit}
        onCancel={handleCancelEdit}
      />
    </div>
  );
}
