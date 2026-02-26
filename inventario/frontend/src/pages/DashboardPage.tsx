import { useEffect, useState } from 'react';
import { Header } from '../layouts/Header';
import { dashboardService } from '../services/dashboard.service';
import { DashboardSkeleton } from '../components/LoadingSkeleton';
import { ErrorState } from '../components/ErrorState';
import {
  ClipboardList,
  Package,
  CheckCircle2,
  Clock,
  AlertTriangle,
  TrendingUp,
} from 'lucide-react';
import type { DashboardData } from '../types';

function StatCard({ icon: Icon, label, value, color }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${color}`}>
        <Icon className="w-6 h-6" />
      </div>
      <div>
        <p className="text-2xl font-bold text-slate-800">{value}</p>
        <p className="text-sm text-slate-500">{label}</p>
      </div>
    </div>
  );
}

export function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  function loadData() {
    setLoading(true);
    setError(false);
    dashboardService.getResumo()
      .then(setData)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadData(); }, []);

  return (
    <>
      <Header title="Dashboard" />
      <div className="p-6 space-y-6">
        {loading ? (
          <DashboardSkeleton />
        ) : error ? (
          <ErrorState message="Erro ao carregar dados do dashboard." onRetry={loadData} />
        ) : data ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              <StatCard
                icon={ClipboardList}
                label="Inventarios Ativos"
                value={data.active_inventories}
                color="bg-blue-100 text-blue-600"
              />
              <StatCard
                icon={TrendingUp}
                label="Em Andamento"
                value={data.in_progress}
                color="bg-indigo-100 text-indigo-600"
              />
              <StatCard
                icon={CheckCircle2}
                label="Itens Contados"
                value={data.counted_items}
                color="bg-green-100 text-green-600"
              />
              <StatCard
                icon={Clock}
                label="Itens Pendentes"
                value={data.pending_items}
                color="bg-amber-100 text-amber-600"
              />
              <StatCard
                icon={AlertTriangle}
                label="Divergencias"
                value={data.divergences}
                color="bg-red-100 text-red-600"
              />
              <StatCard
                icon={Package}
                label="Produtos Cadastrados"
                value={data.total_products}
                color="bg-purple-100 text-purple-600"
              />
              <StatCard
                icon={CheckCircle2}
                label="Contagens Hoje"
                value={data.countings_today}
                color="bg-teal-100 text-teal-600"
              />
              <StatCard
                icon={ClipboardList}
                label="Total Inventarios"
                value={data.total_inventories}
                color="bg-slate-100 text-slate-600"
              />
            </div>

            {data.progress > 0 && (
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <h3 className="text-lg font-semibold text-slate-800 mb-3">Progresso Geral</h3>
                <div className="flex items-center gap-4">
                  <div className="flex-1 h-4 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-capul-500 rounded-full transition-all"
                      style={{ width: `${data.progress}%` }}
                    />
                  </div>
                  <span className="text-lg font-semibold text-slate-700">{data.progress}%</span>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-12 text-slate-500">
            Nenhum dado disponivel. Crie seu primeiro inventario para comecar.
          </div>
        )}
      </div>
    </>
  );
}
