import { useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Header } from '../../layouts/Header';
import { inventoryService } from '../../services/inventory.service';
import { ScannerInput } from './components/ScannerInput';
import { CountingProgress } from './components/CountingProgress';
import { useCountingData } from './hooks/useCountingData';
import type { CountingFilter } from './hooks/useCountingData';
import { ArrowLeft, Save, Package } from 'lucide-react';
import { TableSkeleton } from '../../components/LoadingSkeleton';
import { useToast } from '../../contexts/ToastContext';
import type { CountingListProduct } from '../../types';

const filterOptions: { key: CountingFilter; label: string }[] = [
  { key: 'all', label: 'Todos' },
  { key: 'pending', label: 'Pendentes' },
  { key: 'counted', label: 'Contados' },
  { key: 'divergent', label: 'Divergentes' },
];

const itemStatusConfig: Record<string, { label: string; color: string }> = {
  PENDING: { label: 'Pendente', color: 'bg-slate-100 text-slate-600' },
  COUNTED: { label: 'Contado', color: 'bg-blue-100 text-blue-700' },
  REVIEWED: { label: 'Revisado', color: 'bg-amber-100 text-amber-700' },
  APPROVED: { label: 'Aprovado', color: 'bg-green-100 text-green-700' },
  ZERO_CONFIRMED: { label: 'Zero', color: 'bg-purple-100 text-purple-700' },
};

export function ContagemDesktopPage() {
  const { inventoryId } = useParams<{ inventoryId: string }>();
  const navigate = useNavigate();
  const { inventario, products, loading, filter, setFilter, stats, updateProduct, reload } = useCountingData(inventoryId!);
  const toast = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const rowRefs = useRef<Map<string, HTMLTableRowElement>>(new Map());

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

    // Scroll to product
    const row = rowRefs.current.get(product.id);
    if (row) {
      row.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    // Highlight and start editing
    setHighlightId(product.id);
    setEditingId(product.id);
    setEditValue('');
    setTimeout(() => setHighlightId(null), 2000);
  }, [products]);

  // Save a count for a product
  const handleSaveCount = useCallback(async (product: CountingListProduct, quantity: number) => {
    setSavingId(product.id);
    try {
      await inventoryService.registrarContagem(product.id, { quantity });
      // Update locally
      updateProduct(product.id, {
        count_cycle_1: quantity,
        status: 'COUNTED',
      });
      setEditingId(null);
      setEditValue('');
      toast.success('Contagem salva.');
    } catch {
      toast.error('Erro ao salvar contagem.');
    } finally {
      setSavingId(null);
    }
  }, [updateProduct]);

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
        <div className="p-4 md:p-6"><TableSkeleton rows={8} cols={8} /></div>
      </>
    );
  }

  return (
    <>
      <Header title={`Contagem — ${inventario?.name || 'Inventario'}`} />
      <div className="p-4 md:p-6 space-y-4">
        {/* Voltar */}
        <button
          onClick={() => navigate('/inventario/contagem')}
          className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar para selecao
        </button>

        {/* Info bar */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="text-center p-3 bg-white rounded-xl border border-slate-200">
            <p className="text-xs text-slate-500">Armazem</p>
            <p className="text-lg font-bold text-slate-800">{inventario?.warehouse || '—'}</p>
          </div>
          <div className="text-center p-3 bg-white rounded-xl border border-slate-200">
            <p className="text-xs text-slate-500">Ciclo</p>
            <p className="text-lg font-bold text-slate-800">{inventario?.current_cycle || 1}o</p>
          </div>
          <div className="text-center p-3 bg-white rounded-xl border border-slate-200">
            <p className="text-xs text-slate-500">Total</p>
            <p className="text-lg font-bold text-slate-800">{stats.total}</p>
          </div>
          <div className="text-center p-3 bg-white rounded-xl border border-slate-200">
            <p className="text-xs text-slate-500">Contados</p>
            <p className="text-lg font-bold text-green-600">{stats.counted}</p>
          </div>
          <div className="text-center p-3 bg-white rounded-xl border border-slate-200">
            <p className="text-xs text-slate-500">Pendentes</p>
            <p className="text-lg font-bold text-amber-600">{stats.pending}</p>
          </div>
        </div>

        {/* Toolbar: scanner + filtros */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="w-full md:w-80">
            <ScannerInput onScan={handleScan} placeholder="Escanear codigo do produto..." />
          </div>

          <div className="flex gap-1">
            {filterOptions.map((opt) => (
              <button
                key={opt.key}
                onClick={() => setFilter(opt.key)}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
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
            className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 text-slate-600 text-sm rounded-lg hover:bg-slate-50"
          >
            <Save className="w-4 h-4" />
            Atualizar
          </button>
        </div>

        {/* Tabela de produtos */}
        {products.length === 0 ? (
          <div className="text-center py-8">
            <Package className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-slate-500 text-sm">
              {filter === 'all' ? 'Nenhum produto neste inventario.' : 'Nenhum produto com este filtro.'}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left py-2.5 px-3 font-medium text-slate-600 w-10">#</th>
                  <th className="text-left py-2.5 px-3 font-medium text-slate-600">Codigo</th>
                  <th className="text-left py-2.5 px-3 font-medium text-slate-600">Descricao</th>
                  <th className="text-right py-2.5 px-3 font-medium text-slate-600">Saldo Sist.</th>
                  <th className="text-right py-2.5 px-3 font-medium text-slate-600">Esperado</th>
                  <th className="text-right py-2.5 px-3 font-medium text-capul-700 bg-capul-50">Qtd Contada</th>
                  <th className="text-right py-2.5 px-3 font-medium text-slate-600">Diferenca</th>
                  <th className="text-left py-2.5 px-3 font-medium text-slate-600">Status</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => {
                  const isEditing = editingId === p.id;
                  const isSaving = savingId === p.id;
                  const isHighlighted = highlightId === p.id;
                  const isc = itemStatusConfig[p.status] || itemStatusConfig.PENDING;
                  const countedQty = p.count_cycle_1;
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
                          ? 'bg-amber-50/50'
                          : p.status === 'APPROVED'
                          ? 'bg-green-50/30'
                          : p.status !== 'PENDING'
                          ? 'bg-green-50/20'
                          : 'hover:bg-slate-50'
                      }`}
                    >
                      <td className="py-2.5 px-3 text-slate-400 text-xs">{p.sequence}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-700">{p.product_code}</td>
                      <td className="py-2.5 px-3 text-slate-800 truncate max-w-[200px]">
                        {p.product_description || p.product_name}
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-600">{p.system_qty.toFixed(2)}</td>
                      <td className="py-2.5 px-3 text-right text-slate-600">{p.expected_quantity.toFixed(2)}</td>

                      {/* Qtd Contada — editavel */}
                      <td className="py-2.5 px-3 text-right bg-capul-50/30">
                        {isEditing ? (
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
                            className="w-24 text-right border border-capul-400 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-capul-500"
                          />
                        ) : (
                          <button
                            onClick={() => {
                              setEditingId(p.id);
                              setEditValue(countedQty !== null ? String(countedQty) : '');
                            }}
                            className={`min-w-[60px] text-right font-medium ${
                              countedQty !== null
                                ? 'text-capul-700'
                                : 'text-slate-300 hover:text-capul-500'
                            }`}
                          >
                            {isSaving ? '...' : countedQty !== null ? countedQty.toFixed(2) : 'Contar'}
                          </button>
                        )}
                      </td>

                      {/* Diferenca */}
                      <td className={`py-2.5 px-3 text-right font-medium ${
                        diff !== null && diff > 0 ? 'text-green-600' : diff !== null && diff < 0 ? 'text-red-600' : 'text-slate-400'
                      }`}>
                        {diff !== null ? (
                          <>{diff > 0 ? '+' : ''}{diff.toFixed(2)}</>
                        ) : '—'}
                      </td>

                      {/* Status */}
                      <td className="py-2.5 px-3">
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

        {/* Barra de progresso */}
        <CountingProgress
          total={stats.total}
          counted={stats.counted}
          divergent={stats.divergent}
        />
      </div>
    </>
  );
}
