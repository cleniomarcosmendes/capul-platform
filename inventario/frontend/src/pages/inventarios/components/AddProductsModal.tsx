import { useEffect, useState, useCallback } from 'react';
import { X, Search, ChevronLeft, ChevronRight, Package } from 'lucide-react';
import { productService } from '../../../services/product.service';
import { inventoryService } from '../../../services/inventory.service';
import type { ProtheusProduct } from '../../../types';

interface Props {
  inventoryId: string;
  onClose: () => void;
  onAdded: () => void;
}

export function AddProductsModal({ inventoryId, onClose, onAdded }: Props) {
  const [products, setProducts] = useState<ProtheusProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ added: number; errors: string[] } | null>(null);

  const loadProducts = useCallback(() => {
    setLoading(true);
    const params: Record<string, string> = { page: String(page), limit: '20' };
    if (search) params.search = search;
    productService.listarProtheus(params)
      .then((res) => {
        setProducts(res.products || []);
        setTotal(res.total || 0);
        setTotalPages(res.pages || 1);
      })
      .catch(() => {
        setProducts([]);
        setTotal(0);
        setTotalPages(1);
      })
      .finally(() => setLoading(false));
  }, [page, search]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearch(searchInput.trim());
    setPage(1);
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleSelectAll() {
    if (products.every((p) => selected.has(p.id))) {
      setSelected((prev) => {
        const next = new Set(prev);
        products.forEach((p) => next.delete(p.id));
        return next;
      });
    } else {
      setSelected((prev) => {
        const next = new Set(prev);
        products.forEach((p) => next.add(p.id));
        return next;
      });
    }
  }

  async function handleAdd() {
    if (selected.size === 0) return;

    setSaving(true);
    setResult(null);

    // Map selected products to items payload
    const selectedProducts = products.filter((p) => selected.has(p.id));
    const items = selectedProducts.map((p) => ({
      product_id: Number(p.id),
      expected_quantity: p.total_stock,
    }));

    try {
      const res = await inventoryService.adicionarItensBulk(inventoryId, items);
      setResult(res);
      if (res.added > 0) {
        onAdded();
      }
    } catch {
      setResult({ added: 0, errors: ['Erro inesperado ao adicionar produtos.'] });
    } finally {
      setSaving(false);
    }
  }

  const allOnPageSelected = products.length > 0 && products.every((p) => selected.has(p.id));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 shrink-0">
          <div>
            <h3 className="text-lg font-semibold text-slate-800">Adicionar Produtos</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {selected.size > 0
                ? `${selected.size} produto${selected.size !== 1 ? 's' : ''} selecionado${selected.size !== 1 ? 's' : ''}`
                : 'Selecione os produtos para adicionar ao inventario'}
            </p>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search bar */}
        <div className="p-4 border-b border-slate-100 shrink-0">
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Buscar por codigo ou descricao..."
                className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-capul-500"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 bg-slate-100 text-slate-700 text-sm rounded-lg hover:bg-slate-200"
            >
              Buscar
            </button>
          </form>
        </div>

        {/* Result message */}
        {result && (
          <div className={`mx-4 mt-3 p-3 rounded-lg text-sm ${
            result.errors.length > 0
              ? 'bg-amber-50 border border-amber-200 text-amber-700'
              : 'bg-green-50 border border-green-200 text-green-700'
          }`}>
            {result.added > 0 && <span>{result.added} produto{result.added !== 1 ? 's' : ''} adicionado{result.added !== 1 ? 's' : ''}. </span>}
            {result.errors.length > 0 && <span>{result.errors.length} erro{result.errors.length !== 1 ? 's' : ''}.</span>}
          </div>
        )}

        {/* Table */}
        <div className="flex-1 overflow-auto p-4">
          {loading ? (
            <div className="text-center py-8 text-slate-500">Carregando produtos...</div>
          ) : products.length === 0 ? (
            <div className="text-center py-8">
              <Package className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-slate-500 text-sm">Nenhum produto encontrado.</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="py-2.5 px-3 w-10">
                      <input
                        type="checkbox"
                        checked={allOnPageSelected}
                        onChange={toggleSelectAll}
                        className="rounded border-slate-300"
                      />
                    </th>
                    <th className="text-left py-2.5 px-3 font-medium text-slate-600">Codigo</th>
                    <th className="text-left py-2.5 px-3 font-medium text-slate-600">Descricao</th>
                    <th className="text-left py-2.5 px-3 font-medium text-slate-600">Grupo</th>
                    <th className="text-left py-2.5 px-3 font-medium text-slate-600">Categoria</th>
                    <th className="text-right py-2.5 px-3 font-medium text-slate-600">Estoque</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => (
                    <tr
                      key={p.id}
                      onClick={() => toggleSelect(p.id)}
                      className={`border-b border-slate-100 cursor-pointer ${
                        selected.has(p.id) ? 'bg-capul-50' : 'hover:bg-slate-50'
                      }`}
                    >
                      <td className="py-2.5 px-3">
                        <input
                          type="checkbox"
                          checked={selected.has(p.id)}
                          onChange={() => toggleSelect(p.id)}
                          className="rounded border-slate-300"
                        />
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-700">{p.b1_cod}</td>
                      <td className="py-2.5 px-3 text-slate-800 truncate max-w-xs">{p.b1_desc}</td>
                      <td className="py-2.5 px-3 text-slate-500 text-xs">{p.grupo_desc || p.b1_grupo}</td>
                      <td className="py-2.5 px-3 text-slate-500 text-xs">{p.categoria_desc || p.b1_xcatgor || '—'}</td>
                      <td className="py-2.5 px-3 text-right text-slate-600">{p.total_stock.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer: pagination + action */}
        <div className="flex items-center justify-between p-4 border-t border-slate-200 shrink-0">
          <div className="flex items-center gap-3 text-sm text-slate-500">
            <span>{total} produto{total !== 1 ? 's' : ''}</span>
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="p-1 border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-40"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs px-2">{page} / {totalPages}</span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="p-1 border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-40"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50"
            >
              Fechar
            </button>
            <button
              onClick={handleAdd}
              disabled={selected.size === 0 || saving}
              className="px-4 py-2 text-sm text-white bg-capul-600 rounded-lg hover:bg-capul-700 disabled:opacity-50"
            >
              {saving
                ? 'Adicionando...'
                : `Adicionar ${selected.size > 0 ? `(${selected.size})` : ''}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
