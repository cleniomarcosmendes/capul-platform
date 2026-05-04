import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Clock, Loader2, Package } from 'lucide-react';
import { inventoryService } from '../../../services/inventory.service';
import type { CountingHistoryEntry } from '../../../types';

interface HistoricoContagemModalProps {
  open: boolean;
  itemId: string;
  productCode: string;
  productDescription: string;
  onClose: () => void;
}

const cycleColors: Record<number, string> = {
  1: 'bg-green-100 text-green-700',
  2: 'bg-amber-100 text-amber-700',
  3: 'bg-red-100 text-red-700',
};

export function HistoricoContagemModal({
  open,
  itemId,
  productCode,
  productDescription,
  onClose,
}: HistoricoContagemModalProps) {
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<CountingHistoryEntry[]>([]);

  useEffect(() => {
    if (!open || !itemId) return;
    setLoading(true);
    inventoryService.buscarHistoricoContagem(itemId)
      .then((res) => setHistory(res.counting_history))
      .catch(() => setHistory([]))
      .finally(() => setLoading(false));
  }, [open, itemId]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div
        className="relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-slate-200 shrink-0">
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-slate-800">Historico de Contagens</h3>
            <div className="flex items-center gap-2 mt-1">
              <span className="font-mono text-sm text-capul-600">{productCode}</span>
              <span className="text-sm text-slate-500 truncate">{productDescription}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-12">
              <Package className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-slate-500 text-sm">Nenhuma contagem registrada.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {history.map((entry) => (
                <div
                  key={entry.counting_id}
                  className="flex gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100"
                >
                  {/* Cycle badge */}
                  <div className="shrink-0 pt-0.5">
                    <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg text-sm font-bold ${cycleColors[entry.count_number] || 'bg-slate-100 text-slate-600'}`}>
                      C{entry.count_number}
                    </span>
                  </div>

                  {/* Details */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold text-slate-800">
                        {entry.quantity.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                      <span className="text-xs text-slate-400">un</span>
                    </div>

                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                      <span>{entry.counted_by}</span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(entry.counted_at).toLocaleString('pt-BR')}
                      </span>
                    </div>

                    {entry.lot_number && (
                      <div className="mt-1">
                        <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-mono">
                          Lote: {entry.lot_number}
                        </span>
                      </div>
                    )}

                    {entry.observation && (
                      <p className="mt-1 text-xs text-slate-500 italic">
                        {entry.observation}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-slate-200 shrink-0">
          <span className="text-xs text-slate-400">
            {history.length} contagem{history.length !== 1 ? 's' : ''} registrada{history.length !== 1 ? 's' : ''}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
