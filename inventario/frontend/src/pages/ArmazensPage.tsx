import { useEffect, useState } from 'react';
import { Header } from '../layouts/Header';
import { warehouseService } from '../services/warehouse.service';
import { CardSkeleton } from '../components/LoadingSkeleton';
import { ErrorState } from '../components/ErrorState';
import { Warehouse as WarehouseIcon } from 'lucide-react';
import type { Warehouse } from '../types';

export function ArmazensPage() {
  const [armazens, setArmazens] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  function loadData() {
    setLoading(true);
    setError(false);
    warehouseService.listar()
      .then(setArmazens)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadData(); }, []);

  return (
    <>
      <Header title="Armazens" />
      <div className="p-4 md:p-6 space-y-4">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)}
          </div>
        ) : error ? (
          <ErrorState message="Erro ao carregar armazens." onRetry={loadData} />
        ) : armazens.length === 0 ? (
          <div className="text-center py-12">
            <WarehouseIcon className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">Nenhum armazem cadastrado.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {armazens.map((a) => (
              <div key={a.id} className="bg-white rounded-xl border border-slate-200 p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-teal-100 flex items-center justify-center">
                    <WarehouseIcon className="w-5 h-5 text-teal-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-800">{a.name}</h3>
                    <p className="text-xs text-slate-500 font-mono">{a.code}</p>
                  </div>
                </div>
                {a.description && (
                  <p className="text-sm text-slate-600 mb-2">{a.description}</p>
                )}
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  a.is_active
                    ? 'bg-green-100 text-green-700'
                    : 'bg-red-100 text-red-700'
                }`}>
                  {a.is_active ? 'Ativo' : 'Inativo'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
