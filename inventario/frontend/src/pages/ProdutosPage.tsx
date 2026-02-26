import { useEffect, useState } from 'react';
import { Header } from '../layouts/Header';
import { productService } from '../services/product.service';
import { TableSkeleton } from '../components/LoadingSkeleton';
import { ErrorState } from '../components/ErrorState';
import { Package, Search } from 'lucide-react';
import type { Product } from '../types';

export function ProdutosPage() {
  const [produtos, setProdutos] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [busca, setBusca] = useState('');

  function loadData() {
    setLoading(true);
    setError(false);
    productService.listar()
      .then(setProdutos)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadData(); }, []);

  const filtrados = produtos.filter((p) =>
    p.code.toLowerCase().includes(busca.toLowerCase()) ||
    p.description.toLowerCase().includes(busca.toLowerCase())
  );

  return (
    <>
      <Header title="Produtos" />
      <div className="p-4 md:p-6 space-y-4">
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por codigo ou descricao..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-capul-500 focus:border-transparent"
            />
          </div>
        </div>

        {loading ? (
          <TableSkeleton rows={8} cols={6} />
        ) : error ? (
          <ErrorState message="Erro ao carregar produtos." onRetry={loadData} />
        ) : filtrados.length === 0 ? (
          <div className="text-center py-12">
            <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">Nenhum produto encontrado.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left py-3 px-4 font-medium text-slate-600">Codigo</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-600">Descricao</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-600">Unidade</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-600">Cod. Barras</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-600">Categoria</th>
                  <th className="text-right py-3 px-4 font-medium text-slate-600">Qtd Esperada</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((p) => (
                  <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-3 px-4 font-mono text-sm text-slate-700">{p.code}</td>
                    <td className="py-3 px-4 text-slate-800">{p.description}</td>
                    <td className="py-3 px-4 text-slate-600">{p.unit}</td>
                    <td className="py-3 px-4 text-slate-500 font-mono text-xs">{p.barcode || '-'}</td>
                    <td className="py-3 px-4 text-slate-500">{p.category || '-'}</td>
                    <td className="py-3 px-4 text-right text-slate-700">{p.expected_quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
