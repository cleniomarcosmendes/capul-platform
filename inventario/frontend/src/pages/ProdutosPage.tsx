import { useEffect, useState, useCallback } from 'react';
import { Header } from '../layouts/Header';
import { productService } from '../services/product.service';
import { TableSkeleton } from '../components/LoadingSkeleton';
import { ErrorState } from '../components/ErrorState';
import { Package, Search, ChevronLeft, ChevronRight, Eye } from 'lucide-react';
import type { ProtheusProduct, ProtheusProductResponse } from '../types';
import { ProdutoDetalheModal } from './ProdutoDetalheModal';
import { ExportDropdown } from '../components/ExportDropdown';
import { downloadCSV } from '../utils/csv';
import { downloadExcel, printTable } from '../utils/export';

export function ProdutosPage() {
  const [data, setData] = useState<ProtheusProductResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [busca, setBusca] = useState('');
  const [page, setPage] = useState(1);
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
  const limit = 20;

  const loadData = useCallback((p: number, search: string) => {
    setLoading(true);
    setError(false);
    const params: Record<string, string> = { page: String(p), limit: String(limit) };
    if (search.trim()) params.search = search.trim();
    productService.listarProtheus(params)
      .then(setData)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadData(page, busca); }, [page, loadData]);

  function handleSearch() {
    setPage(1);
    loadData(1, busca);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleSearch();
  }

  const produtos = data?.products ?? [];
  const total = data?.total ?? 0;
  const pages = data?.pages ?? 0;
  const from = total > 0 ? (page - 1) * limit + 1 : 0;
  const to = Math.min(page * limit, total);

  return (
    <>
      <Header title="Produtos" />
      <div className="p-4 md:p-6 space-y-4">
        {/* Search */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por codigo ou descricao..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-capul-500 focus:border-transparent"
            />
          </div>
          <button
            onClick={handleSearch}
            className="px-4 py-2 bg-capul-600 text-white text-sm rounded-lg hover:bg-capul-700"
          >
            Buscar
          </button>

          {produtos.length > 0 && (
            <ExportDropdown
              onCSV={() => {
                const header = 'Codigo;Descricao;Grupo;Categoria;Subcategoria;Segmento;Estoque\n';
                const rows = produtos.map((p) =>
                  `${p.b1_cod};${p.b1_desc};${p.grupo_desc || p.b1_grupo};${p.categoria_desc || p.b1_xcatgor};${p.subcategoria_desc || p.b1_xsubcat};${p.segmento_desc || p.b1_xsegmen};${p.total_stock ?? 0}`,
                );
                downloadCSV(`produtos_${new Date().toISOString().slice(0, 10)}.csv`, header, rows);
              }}
              onExcel={() => {
                downloadExcel(`produtos_${new Date().toISOString().slice(0, 10)}`, 'Produtos',
                  ['Codigo', 'Descricao', 'Grupo', 'Categoria', 'Subcategoria', 'Segmento', 'Estoque'],
                  produtos.map((p) => [p.b1_cod, p.b1_desc, p.grupo_desc || p.b1_grupo, p.categoria_desc || p.b1_xcatgor, p.subcategoria_desc || p.b1_xsubcat, p.segmento_desc || p.b1_xsegmen, p.total_stock ?? 0]),
                );
              }}
              onPrint={() => {
                printTable('Produtos',
                  ['Codigo', 'Descricao', 'Grupo', 'Categoria', 'Subcategoria', 'Segmento', 'Estoque'],
                  produtos.map((p) => [p.b1_cod, p.b1_desc, p.grupo_desc || p.b1_grupo, p.categoria_desc || p.b1_xcatgor, p.subcategoria_desc || p.b1_xsubcat, p.segmento_desc || p.b1_xsegmen, p.total_stock ?? 0]),
                );
              }}
            />
          )}
        </div>

        {/* Info */}
        {!loading && !error && (
          <p className="text-xs text-slate-500">
            Mostrando {from.toLocaleString('pt-BR')} - {to.toLocaleString('pt-BR')} de {total.toLocaleString('pt-BR')} produtos
          </p>
        )}

        {loading ? (
          <TableSkeleton rows={8} cols={7} />
        ) : error ? (
          <ErrorState message="Erro ao carregar produtos." onRetry={() => loadData(page, busca)} />
        ) : produtos.length === 0 ? (
          <div className="text-center py-12">
            <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">Nenhum produto encontrado.</p>
          </div>
        ) : (
          <>
            <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left py-3 px-4 font-medium text-slate-600">Codigo</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-600">Descricao</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-600">Grupo</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-600">Categoria</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-600">Subcategoria</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-600">Segmento</th>
                    <th className="text-right py-3 px-4 font-medium text-slate-600">Estoque</th>
                    <th className="py-3 px-3 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {produtos.map((p: ProtheusProduct) => (
                    <tr
                      key={p.id}
                      className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer"
                      onClick={() => setSelectedProduct(p.b1_cod)}
                    >
                      <td className="py-2.5 px-4 font-mono text-xs text-slate-700">{p.b1_cod}</td>
                      <td className="py-2.5 px-4 text-slate-800 max-w-xs truncate" title={p.b1_desc}>{p.b1_desc}</td>
                      <td className="py-2.5 px-4 text-slate-600 text-xs" title={p.b1_grupo}>{p.grupo_desc || p.b1_grupo}</td>
                      <td className="py-2.5 px-4 text-slate-600 text-xs" title={p.b1_xcatgor}>{p.categoria_desc || p.b1_xcatgor}</td>
                      <td className="py-2.5 px-4 text-slate-600 text-xs" title={p.b1_xsubcat}>{p.subcategoria_desc || p.b1_xsubcat}</td>
                      <td className="py-2.5 px-4 text-slate-600 text-xs" title={p.b1_xsegmen}>{p.segmento_desc || p.b1_xsegmen}</td>
                      <td className="py-2.5 px-4 text-right font-mono text-sm text-slate-700">
                        {p.total_stock?.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) ?? '0'}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <Eye className="w-4 h-4 text-slate-400 hover:text-capul-600 inline-block" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pages > 1 && (
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-500">
                  Pagina {page} de {pages.toLocaleString('pt-BR')}
                </p>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="p-2 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  {pageNumbers(page, pages).map((n, i) =>
                    n === '...' ? (
                      <span key={`dot-${i}`} className="px-2 text-slate-400 text-sm">...</span>
                    ) : (
                      <button
                        key={n}
                        onClick={() => setPage(Number(n))}
                        className={`min-w-[2rem] h-8 rounded-lg text-sm font-medium transition-colors ${
                          Number(n) === page
                            ? 'bg-capul-600 text-white'
                            : 'border border-slate-300 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {n}
                      </button>
                    )
                  )}
                  <button
                    onClick={() => setPage((p) => Math.min(pages, p + 1))}
                    disabled={page >= pages}
                    className="p-2 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {selectedProduct && (
        <ProdutoDetalheModal
          productId={selectedProduct}
          onClose={() => setSelectedProduct(null)}
        />
      )}
    </>
  );
}

function pageNumbers(current: number, total: number): (number | string)[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | string)[] = [1];
  if (current > 3) pages.push('...');
  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) {
    pages.push(i);
  }
  if (current < total - 2) pages.push('...');
  pages.push(total);
  return pages;
}
