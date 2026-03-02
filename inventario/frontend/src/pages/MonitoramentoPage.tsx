import { useEffect, useState, useCallback, useRef } from 'react';
import { Header } from '../layouts/Header';
import { monitoringService } from '../services/monitoring.service';
import { DashboardSkeleton } from '../components/LoadingSkeleton';
import { ErrorState } from '../components/ErrorState';
import type { MonitoringHealth, MonitoringAnomaly, MonitoringAnomaliesResponse, AnomalySeverity } from '../types';
import { Activity, RefreshCw, ShieldCheck, ShieldAlert, AlertTriangle, Package, CheckCircle2, ClipboardList } from 'lucide-react';

const REFRESH_INTERVAL = 30_000;

function formatRelativeTime(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'Agora';
  if (mins < 60) return `${mins} min atrás`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h atrás`;
  return new Date(isoDate).toLocaleDateString('pt-BR');
}

const severityConfig: Record<AnomalySeverity, { label: string; bg: string; text: string; border: string }> = {
  CRITICAL: { label: 'Critico', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
  HIGH: { label: 'Alto', bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
  MEDIUM: { label: 'Medio', bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200' },
};

export default function MonitoramentoPage() {
  const [health, setHealth] = useState<MonitoringHealth | null>(null);
  const [anomaliesData, setAnomaliesData] = useState<MonitoringAnomaliesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadData = useCallback(async (silent = false) => {
    if (!silent) { setLoading(true); setError(false); }
    try {
      const [h, a] = await Promise.all([
        monitoringService.getHealth(),
        monitoringService.getAnomalies(),
      ]);
      setHealth(h);
      setAnomaliesData(a);
    } catch {
      if (!silent) setError(true);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    intervalRef.current = setInterval(() => loadData(true), REFRESH_INTERVAL);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [loadData]);

  const summary = anomaliesData?.summary;
  const anomalies = anomaliesData?.anomalies ?? [];
  const critical = anomalies.filter((a) => a.severity === 'CRITICAL');
  const grouped = (['CRITICAL', 'HIGH', 'MEDIUM'] as AnomalySeverity[]).map((sev) => ({
    severity: sev,
    items: anomalies.filter((a) => a.severity === sev),
  })).filter((g) => g.items.length > 0);

  const isHealthy = health?.status === 'healthy';

  return (
    <>
      <Header title="Monitoramento" />
      <div className="p-4 md:p-6 space-y-6">
        {loading ? (
          <DashboardSkeleton />
        ) : error ? (
          <ErrorState message="Erro ao carregar monitoramento." onRetry={() => loadData()} />
        ) : (
          <>
            {/* Refresh indicator */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                </span>
                Auto-refresh a cada 30s
              </div>
              <button onClick={() => loadData()} className="flex items-center gap-1.5 text-sm text-capul-600 hover:text-capul-800">
                <RefreshCw className="w-4 h-4" /> Atualizar
              </button>
            </div>

            {/* Stat cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className={`rounded-lg border p-4 ${isHealthy ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                <div className="flex items-center gap-3">
                  {isHealthy ? <ShieldCheck className="w-8 h-8 text-green-600" /> : <ShieldAlert className="w-8 h-8 text-red-600" />}
                  <div>
                    <p className="text-xs text-slate-500">Status do Sistema</p>
                    <p className={`text-lg font-bold ${isHealthy ? 'text-green-700' : 'text-red-700'}`}>
                      {isHealthy ? 'Saudavel' : 'Alerta'}
                    </p>
                  </div>
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="flex items-center gap-3">
                  <Package className="w-8 h-8 text-blue-500" />
                  <div>
                    <p className="text-xs text-slate-500">Total Inventarios</p>
                    <p className="text-lg font-bold text-slate-800">{health?.total_inventories ?? 0}</p>
                  </div>
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="flex items-center gap-3">
                  <ClipboardList className="w-8 h-8 text-amber-500" />
                  <div>
                    <p className="text-xs text-slate-500">Em Andamento</p>
                    <p className="text-lg font-bold text-slate-800">{health?.active_inventories ?? 0}</p>
                  </div>
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-8 h-8 text-green-500" />
                  <div>
                    <p className="text-xs text-slate-500">Concluidos</p>
                    <p className="text-lg font-bold text-slate-800">{health?.completed_inventories ?? 0}</p>
                  </div>
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-8 h-8 text-orange-500" />
                  <div>
                    <p className="text-xs text-slate-500">Anomalias</p>
                    <p className="text-lg font-bold text-slate-800">{summary?.total_anomalies ?? 0}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Critical alerts */}
            {critical.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-red-700 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  Alertas Criticos ({critical.length})
                </h3>
                <div className="space-y-2">
                  {critical.map((a, i) => (
                    <AnomalyCard key={i} anomaly={a} />
                  ))}
                </div>
              </div>
            )}

            {/* All anomalies grouped */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <Activity className="w-4 h-4" />
                Todas as Anomalias
              </h3>
              {grouped.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <ShieldCheck className="w-12 h-12 mx-auto mb-3 text-green-400" />
                  <p className="text-sm">Nenhuma anomalia detectada.</p>
                </div>
              ) : (
                grouped.map((g) => (
                  <div key={g.severity} className="space-y-2">
                    <p className={`text-xs font-medium ${severityConfig[g.severity].text}`}>
                      {severityConfig[g.severity].label} ({g.items.length})
                    </p>
                    {g.items.map((a, i) => (
                      <AnomalyCard key={i} anomaly={a} />
                    ))}
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}

function AnomalyCard({ anomaly }: { anomaly: MonitoringAnomaly }) {
  const cfg = severityConfig[anomaly.severity];
  return (
    <div className={`rounded-lg border ${cfg.border} ${cfg.bg} p-4`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cfg.text} ${cfg.bg} border ${cfg.border}`}>
              {cfg.label}
            </span>
            <h4 className="text-sm font-semibold text-slate-800">{anomaly.title}</h4>
          </div>
          <p className="text-sm text-slate-600 mb-2">{anomaly.description}</p>
          <div className="flex flex-wrap gap-3 text-xs text-slate-500">
            {anomaly.inventory_name && <span>Inventario: {anomaly.inventory_name}</span>}
            {anomaly.counting_list_code && <span>Lista: {anomaly.counting_list_code}</span>}
            {anomaly.affected_products != null && <span>Produtos: {anomaly.affected_products}</span>}
          </div>
        </div>
        <span className="text-xs text-slate-400 whitespace-nowrap ml-4">
          {formatRelativeTime(anomaly.detected_at)}
        </span>
      </div>
    </div>
  );
}
