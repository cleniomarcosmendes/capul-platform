import { useEffect, useState, useCallback } from 'react';
import { Header } from '../layouts/Header';
import { discrepancyService } from '../services/discrepancy.service';
import { TableSkeleton } from '../components/LoadingSkeleton';
import { ErrorState } from '../components/ErrorState';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import type { Discrepancy, ClosedRound } from '../types';
import { CheckCircle, RotateCcw, Edit3, Filter } from 'lucide-react';

export default function DivergenciasPage() {
  const [discrepancies, setDiscrepancies] = useState<Discrepancy[]>([]);
  const [rounds, setRounds] = useState<ClosedRound[]>([]);
  const [selectedRound, setSelectedRound] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const toast = useToast();
  const { inventarioRole } = useAuth();
  const isStaff = inventarioRole === 'ADMIN' || inventarioRole === 'SUPERVISOR';

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const [items, rds] = await Promise.all([
        discrepancyService.listar(selectedRound || undefined),
        rounds.length ? Promise.resolve(rounds) : discrepancyService.listarRodadas(),
      ]);
      setDiscrepancies(items);
      if (!rounds.length) setRounds(rds);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [selectedRound, rounds.length]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleResolve = async (id: string, type: 'ACCEPT' | 'RECOUNT' | 'ADJUST') => {
    let finalQuantity: number | undefined;
    if (type === 'ADJUST') {
      const input = prompt('Informe a quantidade final ajustada:');
      if (input === null) return;
      finalQuantity = parseFloat(input);
      if (isNaN(finalQuantity)) { toast.error('Quantidade invalida.'); return; }
    }

    setResolvingId(id);
    try {
      await discrepancyService.resolver(id, {
        resolution_type: type,
        final_quantity: finalQuantity,
        notes: type === 'ACCEPT' ? 'Contagem aceita' : type === 'RECOUNT' ? 'Recontagem solicitada' : `Ajuste manual: ${finalQuantity}`,
      });
      toast.success(
        type === 'ACCEPT' ? 'Contagem aceita.' :
        type === 'RECOUNT' ? 'Recontagem solicitada.' :
        'Ajuste manual aplicado.',
      );
      loadData();
    } catch {
      toast.error('Erro ao resolver divergencia.');
    } finally {
      setResolvingId(null);
    }
  };

  // Stats
  const total = discrepancies.length;
  const pending = discrepancies.filter((d) => d.status === 'PENDING').length;
  const resolved = discrepancies.filter((d) => d.status === 'RESOLVED').length;
  const avgVariance = total > 0
    ? (discrepancies.reduce((s, d) => s + Math.abs(d.variance_percentage), 0) / total).toFixed(1)
    : '0.0';

  return (
    <>
      <Header title="Divergencias" />
      <div className="p-6 space-y-6">
        {/* Filter */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={selectedRound}
              onChange={(e) => setSelectedRound(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-capul-500"
            >
              <option value="">Todas as Rodadas</option>
              {rounds.map((r) => (
                <option key={r.round_key} value={r.round_key}>{r.display_text}</option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <TableSkeleton rows={6} cols={8} />
        ) : error ? (
          <ErrorState message="Erro ao carregar divergencias." onRetry={loadData} />
        ) : (
          <>
            {/* Stat cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard label="Total" value={total} color="text-slate-800" />
              <StatCard label="Pendentes" value={pending} color="text-yellow-600" />
              <StatCard label="Resolvidas" value={resolved} color="text-green-600" />
              <StatCard label="Diverg. Media" value={`${avgVariance}%`} color="text-red-600" />
            </div>

            {/* Table */}
            {discrepancies.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-400" />
                <p className="text-sm">Nenhuma divergencia encontrada.</p>
              </div>
            ) : (
              <div className="bg-white rounded-lg border border-slate-200 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-left">
                      <th className="py-3 px-4 font-medium text-slate-600">Codigo</th>
                      <th className="py-3 px-4 font-medium text-slate-600">Descricao</th>
                      <th className="py-3 px-4 font-medium text-slate-600 text-right">Qtd Sistema</th>
                      <th className="py-3 px-4 font-medium text-slate-600 text-right">Qtd Contada</th>
                      <th className="py-3 px-4 font-medium text-slate-600 text-right">Diferenca</th>
                      <th className="py-3 px-4 font-medium text-slate-600 text-right">%</th>
                      <th className="py-3 px-4 font-medium text-slate-600">Status</th>
                      {isStaff && <th className="py-3 px-4 font-medium text-slate-600">Acoes</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {discrepancies.map((d) => {
                      const counted = d.counted_quantity ?? (d.expected_quantity + d.variance_quantity);
                      return (
                        <tr key={d.id} className="hover:bg-slate-50">
                          <td className="py-2.5 px-4 font-mono text-xs">{d.product_code}</td>
                          <td className="py-2.5 px-4 max-w-[200px] truncate">{d.product_description}</td>
                          <td className="py-2.5 px-4 text-right">{d.expected_quantity}</td>
                          <td className="py-2.5 px-4 text-right">{counted}</td>
                          <td className={`py-2.5 px-4 text-right font-medium ${d.variance_quantity > 0 ? 'text-blue-600' : d.variance_quantity < 0 ? 'text-red-600' : 'text-slate-600'}`}>
                            {d.variance_quantity > 0 ? '+' : ''}{d.variance_quantity}
                          </td>
                          <td className={`py-2.5 px-4 text-right ${Math.abs(d.variance_percentage) > 10 ? 'text-red-600 font-medium' : 'text-slate-600'}`}>
                            {d.variance_percentage.toFixed(1)}%
                          </td>
                          <td className="py-2.5 px-4">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${d.status === 'RESOLVED' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                              {d.status === 'RESOLVED' ? 'Resolvido' : 'Pendente'}
                            </span>
                          </td>
                          {isStaff && (
                            <td className="py-2.5 px-4">
                              {d.status === 'PENDING' && (
                                <div className="flex gap-1">
                                  <button
                                    onClick={() => handleResolve(d.id, 'ACCEPT')}
                                    disabled={resolvingId === d.id}
                                    className="p-1.5 rounded hover:bg-green-50 text-green-600 disabled:opacity-50"
                                    title="Aceitar contagem"
                                  >
                                    <CheckCircle className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleResolve(d.id, 'RECOUNT')}
                                    disabled={resolvingId === d.id}
                                    className="p-1.5 rounded hover:bg-blue-50 text-blue-600 disabled:opacity-50"
                                    title="Solicitar recontagem"
                                  >
                                    <RotateCcw className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleResolve(d.id, 'ADJUST')}
                                    disabled={resolvingId === d.id}
                                    className="p-1.5 rounded hover:bg-orange-50 text-orange-600 disabled:opacity-50"
                                    title="Ajuste manual"
                                  >
                                    <Edit3 className="w-4 h-4" />
                                  </button>
                                </div>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}

function StatCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4">
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <p className={`text-xl font-bold ${color}`}>{value}</p>
    </div>
  );
}
