import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '../layouts/Header';
import { integrationService } from '../services/integration.service';
import type { IntegrationHistory } from '../types';
import { ErrorState } from '../components/ErrorState';
import { TableSkeleton } from '../components/LoadingSkeleton';
import { Eye, RefreshCw, Send, ArrowLeftRight, Package, FileWarning, Plus } from 'lucide-react';
import { useTableSort } from '../hooks/useTableSort';
import { SortableTh } from '../components/SortableTh';

const statusConfig: Record<string, { label: string; color: string }> = {
  DRAFT:      { label: 'Aguardando Envio', color: 'bg-slate-100 text-slate-700' },
  PENDING:    { label: 'Pendente',     color: 'bg-amber-100 text-amber-700' },
  SENT:       { label: 'Enviado',      color: 'bg-blue-100 text-blue-700' },
  PROCESSING: { label: 'Processando',  color: 'bg-indigo-100 text-indigo-700' },
  CONFIRMED:  { label: 'Confirmado',   color: 'bg-emerald-100 text-emerald-700' },
  PARTIAL:    { label: 'Parcial',      color: 'bg-orange-100 text-orange-700' },
  ERROR:      { label: 'Erro',         color: 'bg-red-100 text-red-700' },
  CANCELLED:  { label: 'Cancelada',    color: 'bg-slate-100 text-slate-500 line-through' },
};

const typeConfig: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = {
  SIMPLE:      { label: 'Simples',      icon: Package,        color: 'bg-sky-50 text-sky-700' },
  COMPARATIVE: { label: 'Comparativa',  icon: ArrowLeftRight, color: 'bg-purple-50 text-purple-700' },
};

const STATUS_FILTER_OPTIONS = ['', 'DRAFT', 'PENDING', 'SENT', 'PROCESSING', 'CONFIRMED', 'PARTIAL', 'ERROR', 'CANCELLED'];

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function IntegracoesPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<IntegrationHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');

  const load = () => {
    setLoading(true);
    setError(false);
    integrationService.historico(statusFilter || undefined, 200)
      .then((res) => setItems(res.history))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [statusFilter]);

  const filtered = typeFilter
    ? items.filter((i) => i.integration_type === typeFilter)
    : items;

  const { sortedRows, sortKey, sortDir, handleSort } = useTableSort(filtered, 'created_at', 'desc');

  const totalsByStatus = items.reduce((acc, i) => {
    acc[i.status] = (acc[i.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <>
      <Header title="Integrações Protheus" />
      <div className="p-4 md:p-6 space-y-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-start gap-3">
            <FileWarning className="w-5 h-5 text-slate-400 mt-0.5 shrink-0" />
            <div className="text-sm text-slate-600">
              Cada integração é um <strong>registro de envio ao Protheus</strong>. Inventários com integração <em>Enviada</em>,
              <em> Processando</em> ou <em>Confirmada</em> ficam bloqueados para nova integração — para evitar duplicação no ERP.
              Apenas integrações <em>Aguardando Envio</em>, <em>Pendente</em>, <em>Erro</em> ou <em>Parcial</em> podem ser canceladas.
            </div>
          </div>
        </div>

        {/* Resumo por status */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2">
          {['DRAFT', 'PENDING', 'SENT', 'PROCESSING', 'CONFIRMED', 'PARTIAL', 'ERROR', 'CANCELLED'].map((s) => {
            const conf = statusConfig[s];
            const n = totalsByStatus[s] || 0;
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(statusFilter === s ? '' : s)}
                className={`text-left border rounded-lg p-2 transition-colors ${
                  statusFilter === s ? 'border-capul-500 ring-1 ring-capul-500' : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${conf.color}`}>
                  {conf.label}
                </span>
                <p className="text-xl font-bold text-slate-800 mt-1">{n}</p>
              </button>
            );
          })}
        </div>

        {/* Filtros + ações */}
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
          >
            {STATUS_FILTER_OPTIONS.map((s) => (
              <option key={s} value={s}>{s ? statusConfig[s]?.label : 'Todos os status'}</option>
            ))}
          </select>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
          >
            <option value="">Todos os tipos</option>
            <option value="SIMPLE">Simples</option>
            <option value="COMPARATIVE">Comparativa</option>
          </select>
          <button
            onClick={load}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50"
          >
            <RefreshCw className="w-4 h-4" />
            Atualizar
          </button>
          <div className="flex-1" />
          <span className="text-xs text-slate-500">
            {filtered.length} integraç{filtered.length === 1 ? 'ão' : 'ões'}
          </span>
          <button
            onClick={() => navigate('/inventario/integracoes/nova')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-capul-600 text-white rounded-lg hover:bg-capul-700"
          >
            <Plus className="w-4 h-4" />
            Nova Integração
          </button>
        </div>

        {/* Grid */}
        {loading ? (
          <TableSkeleton rows={8} cols={7} />
        ) : error ? (
          <ErrorState message="Erro ao carregar integrações." onRetry={load} />
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
            <Send className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-500">
              {items.length === 0
                ? 'Nenhuma integração registrada ainda.'
                : 'Nenhuma integração com esses filtros.'}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <SortableTh label="Data" sortKey="created_at" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="font-medium text-xs uppercase tracking-wide" />
                    <SortableTh label="Tipo" sortKey="integration_type" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="font-medium text-xs uppercase tracking-wide" />
                    <SortableTh label="Status" sortKey="status" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="font-medium text-xs uppercase tracking-wide" />
                    <th className="text-left py-2 px-3 font-medium text-slate-600 text-xs uppercase tracking-wide" title="Atalho para abrir as listas de itens">Itens</th>
                    <SortableTh label="Inventário A" sortKey="inventory_a_name" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="font-medium text-xs uppercase tracking-wide" />
                    <SortableTh label="Inventário B" sortKey="inventory_b_name" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="font-medium text-xs uppercase tracking-wide" />
                    <SortableTh label="Doc. Transfer." sortKey="protheus_doc_transfers" align="center" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="font-medium text-xs uppercase tracking-wide" />
                    <SortableTh label="Doc. Inv." sortKey="protheus_doc_inventory" align="center" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="font-medium text-xs uppercase tracking-wide" />
                    <SortableTh label="Criado por" sortKey="created_by_name" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="font-medium text-xs uppercase tracking-wide" />
                    <th className="py-2 px-3 w-16"></th>
                  </tr>
                </thead>
                <tbody>
                  {sortedRows.map((it) => {
                    const stat = statusConfig[it.status] || { label: it.status, color: 'bg-slate-100 text-slate-700' };
                    const tp = typeConfig[it.integration_type];
                    const Icon = tp?.icon || Package;
                    return (
                      <tr
                        key={it.id}
                        onClick={() => navigate(`/inventario/integracoes/${it.id}`)}
                        className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer"
                      >
                        <td className="py-2.5 px-3 text-slate-600 text-xs whitespace-nowrap">
                          {formatDate(it.created_at)}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${tp?.color || ''}`}>
                            <Icon className="w-3 h-3" />
                            {tp?.label || it.integration_type}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${stat.color}`}>
                            {stat.label}
                          </span>
                        </td>
                        <td className="py-2.5 px-3" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {(it.summary?.total_transfers ?? 0) > 0 && (
                              <button
                                onClick={() => navigate(`/inventario/integracoes/${it.id}?tab=transfers`)}
                                title="Ver transferências"
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200"
                              >
                                <ArrowLeftRight className="w-3 h-3" />
                                {it.summary.total_transfers}
                              </button>
                            )}
                            <button
                              onClick={() => navigate(`/inventario/integracoes/${it.id}?tab=adjustments`)}
                              title="Ver produtos com divergência"
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200"
                            >
                              <span className="font-medium">{it.summary?.total_adjustments ?? 0}</span>
                              <span className="text-[10px]">c/ div</span>
                            </button>
                            {(it.summary?.total_no_change ?? 0) > 0 && (
                              <button
                                onClick={() => navigate(`/inventario/integracoes/${it.id}?tab=no_change`)}
                                title="Ver produtos sem divergência"
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200"
                              >
                                <span className="font-medium">{it.summary.total_no_change}</span>
                                <span className="text-[10px]">s/ div</span>
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-slate-700">
                          <p className="font-medium">{it.inventory_a_name}</p>
                          <p className="text-xs text-slate-400">Armazém {it.warehouse_a}</p>
                        </td>
                        <td className="py-2.5 px-3 text-slate-700">
                          {it.inventory_b_name ? (
                            <>
                              <p className="font-medium">{it.inventory_b_name}</p>
                              <p className="text-xs text-slate-400">Armazém {it.warehouse_b}</p>
                            </>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center text-xs font-mono text-slate-600">
                          {it.protheus_doc_transfers || <span className="text-slate-300">—</span>}
                        </td>
                        <td className="py-2.5 px-3 text-center text-xs font-mono text-slate-600">
                          {it.protheus_doc_inventory || <span className="text-slate-300">—</span>}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 text-xs">{it.created_by_name}</td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            onClick={(e) => { e.stopPropagation(); navigate(`/inventario/integracoes/${it.id}`); }}
                            title="Ver detalhes"
                            className="p-1.5 rounded text-slate-400 hover:text-capul-600 hover:bg-capul-50"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
