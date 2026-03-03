import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  ArrowRightLeft,
  ClipboardList,
  DollarSign,
  Package,
  Loader2,
  Send,
  TrendingUp,
  TrendingDown,
  ChevronRight,
  ChevronDown,
  Layers,
  AlertTriangle,
  CheckCircle2,
  Info,
} from 'lucide-react';
import { ExportDropdown } from '../../../components/ExportDropdown';
import { downloadCSV } from '../../../utils/csv';
import { downloadExcel, printTable } from '../../../utils/export';
import type {
  IntegrationPreviewResult,
  IntegrationAdjustment,
  IntegrationTransfer,
} from '../../../types';

interface IntegracaoPreviewModalProps {
  open: boolean;
  preview: IntegrationPreviewResult;
  saving: boolean;
  onSave: () => void;
  onClose: () => void;
}

type Tab = 'transfers' | 'adjustments';

function fmtMoney(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtQty(v: number) {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
}

// === Adjustment type mapping ===
// Backend sends: INCREASE (sobra), DECREASE (falta), NO_CHANGE (sem ajuste)

type AdjType = 'INCREASE' | 'DECREASE' | 'NO_CHANGE' | 'MIXED';

function adjTypeLabel(t: string): string {
  if (t === 'INCREASE') return 'Entrada';
  if (t === 'DECREASE') return 'Saida';
  if (t === 'NO_CHANGE') return 'OK';
  if (t === 'MIXED') return 'Misto';
  return t;
}

function adjTypeBadgeClass(t: string): string {
  if (t === 'INCREASE') return 'bg-green-100 text-green-700';
  if (t === 'DECREASE') return 'bg-red-100 text-red-700';
  if (t === 'NO_CHANGE') return 'bg-slate-100 text-slate-600';
  if (t === 'MIXED') return 'bg-amber-100 text-amber-700';
  return 'bg-slate-100 text-slate-500';
}

function adjTypeRowBg(t: string): string {
  if (t === 'INCREASE') return 'bg-green-50/20';
  if (t === 'DECREASE') return 'bg-red-50/20';
  if (t === 'MIXED') return 'bg-amber-50/20';
  return ''; // NO_CHANGE = no color
}

function adjTypeIcon(t: string) {
  if (t === 'INCREASE') return <TrendingUp className="w-3 h-3" />;
  if (t === 'DECREASE') return <TrendingDown className="w-3 h-3" />;
  if (t === 'NO_CHANGE') return <CheckCircle2 className="w-3 h-3" />;
  return <AlertTriangle className="w-3 h-3" />;
}

// === Grouping types ===

interface GroupedAdjustment {
  product_code: string;
  product_description: string;
  warehouse: string;
  total_expected: number;
  total_counted: number;
  total_adjustment: number;
  total_value: number;
  group_type: AdjType;
  lots: IntegrationAdjustment[];
  has_lots: boolean;
  b2_xentpos: number;
}

interface GroupedTransfer {
  product_code: string;
  product_description: string;
  source_warehouse: string;
  target_warehouse: string;
  total_quantity: number;
  total_value: number;
  lots: IntegrationTransfer[];
  has_lots: boolean;
}

function resolveGroupType(items: IntegrationAdjustment[]): AdjType {
  // Ignore NO_CHANGE lots when determining the overall group type
  const meaningful = items.filter((i) => i.adjustment_type !== 'NO_CHANGE');
  if (meaningful.length === 0) return 'NO_CHANGE';
  const types = new Set(meaningful.map((i) => i.adjustment_type));
  if (types.size > 1) return 'MIXED';
  return meaningful[0].adjustment_type as AdjType;
}

function groupAdjustments(adjustments: IntegrationAdjustment[]): GroupedAdjustment[] {
  const map = new Map<string, IntegrationAdjustment[]>();
  for (const a of adjustments) {
    const key = `${a.product_code}__${a.warehouse}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(a);
  }

  const groups: GroupedAdjustment[] = [];
  for (const items of map.values()) {
    const first = items[0];
    // Separate AGGREGATE (totals) from LOT_DETAIL (expansion rows)
    const aggRow = items.find((i) => i.row_type === 'AGGREGATE');
    const lotDetails = items.filter((i) => i.row_type === 'LOT_DETAIL');
    const hasLots = lotDetails.length > 0;

    // Use AGGREGATE row values if present (avoids double-counting)
    const totalExpected = aggRow ? aggRow.expected_qty : items.reduce((s, i) => s + i.expected_qty, 0);
    const totalCounted = aggRow ? aggRow.counted_qty : items.reduce((s, i) => s + i.counted_qty, 0);
    const totalAdj = aggRow ? aggRow.adjustment_qty : items.reduce((s, i) => s + i.adjustment_qty, 0);
    const totalVal = aggRow ? aggRow.total_value : items.reduce((s, i) => s + i.total_value, 0);

    groups.push({
      product_code: first.product_code,
      product_description: first.product_description,
      warehouse: first.warehouse,
      total_expected: totalExpected,
      total_counted: totalCounted,
      total_adjustment: totalAdj,
      total_value: totalVal,
      group_type: resolveGroupType(hasLots ? lotDetails : items),
      lots: hasLots ? lotDetails : items,
      has_lots: hasLots,
      b2_xentpos: aggRow?.b2_xentpos ?? first.b2_xentpos ?? 0,
    });
  }
  return groups;
}

function groupTransfers(transfers: IntegrationTransfer[]): GroupedTransfer[] {
  const map = new Map<string, IntegrationTransfer[]>();
  for (const t of transfers) {
    const key = `${t.product_code}__${t.source_warehouse}__${t.target_warehouse}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(t);
  }

  const groups: GroupedTransfer[] = [];
  for (const items of map.values()) {
    const first = items[0];
    // Separate AGGREGATE (totals) from LOT_DETAIL (expansion rows)
    const aggRow = items.find((i) => i.row_type === 'AGGREGATE');
    const lotDetails = items.filter((i) => i.row_type === 'LOT_DETAIL');
    const hasLots = lotDetails.length > 0;

    // Use AGGREGATE row values if present (avoids double-counting)
    const totalQty = aggRow ? aggRow.quantity : items.reduce((s, i) => s + i.quantity, 0);
    const totalVal = aggRow ? aggRow.total_value : items.reduce((s, i) => s + i.total_value, 0);

    groups.push({
      product_code: first.product_code,
      product_description: first.product_description,
      source_warehouse: first.source_warehouse,
      target_warehouse: first.target_warehouse,
      total_quantity: totalQty,
      total_value: totalVal,
      lots: hasLots ? lotDetails : items,
      has_lots: hasLots,
    });
  }
  return groups;
}

export function IntegracaoPreviewModal({
  open,
  preview,
  saving,
  onSave,
  onClose,
}: IntegracaoPreviewModalProps) {
  const [activeTab, setActiveTab] = useState<Tab>(
    preview.transfers.length > 0 ? 'transfers' : 'adjustments',
  );

  const isComparative = preview.integration_type === 'COMPARATIVE';

  // Export helpers (flat — each lot as a row)
  const transferHeaders = ['Codigo', 'Descricao', 'Lote', 'Origem', 'Destino', 'Quantidade', 'Custo Unit.', 'Valor Total'];
  const adjustmentHeaders = ['Codigo', 'Descricao', 'Lote', 'Armazem', 'Saldo Sistema', 'Contagem Ajust.', 'Ajuste', 'Tipo', 'Custo Unit.', 'Valor Total', 'Entrega Posterior'];

  const transferRows = useMemo(() =>
    preview.transfers.map((t) => [
      t.product_code,
      t.product_description,
      t.lot_number ?? '',
      t.source_warehouse,
      t.target_warehouse,
      fmtQty(t.quantity),
      fmtMoney(t.unit_cost),
      fmtMoney(t.total_value),
    ]),
    [preview.transfers],
  );

  const adjustmentRows = useMemo(() =>
    preview.adjustments.map((a) => [
      a.product_code,
      a.product_description,
      a.lot_number ?? '',
      a.warehouse,
      fmtQty(a.expected_qty),
      fmtQty(a.counted_qty),
      fmtQty(a.adjustment_qty),
      adjTypeLabel(a.adjustment_type),
      fmtMoney(a.unit_cost),
      fmtMoney(a.total_value),
      fmtQty(a.b2_xentpos ?? 0),
    ]),
    [preview.adjustments],
  );

  // Stats for header cards - only count AGGREGATE rows (avoid double-counting with LOT_DETAIL)
  const adjStats = useMemo(() => {
    const aggregates = preview.adjustments.filter((a) => {
      const rt = a.row_type;
      return rt === 'AGGREGATE' || !rt;
    });
    const increases = aggregates.filter((a) => a.adjustment_type === 'INCREASE');
    const decreases = aggregates.filter((a) => a.adjustment_type === 'DECREASE');
    return {
      entradas: increases.length,
      saidas: decreases.length,
      total: aggregates.length,
    };
  }, [preview.adjustments]);

  function handleExport(type: 'csv' | 'excel' | 'print') {
    const isTransfers = activeTab === 'transfers';
    const headers = isTransfers ? transferHeaders : adjustmentHeaders;
    const rows = isTransfers ? transferRows : adjustmentRows;
    const name = isTransfers ? 'Transferencias' : 'Ajustes';

    if (type === 'csv') {
      const csvHeader = headers.join(';') + '\n';
      const csvRows = rows.map((r) => r.join(';'));
      downloadCSV(`integracao_${name.toLowerCase()}.csv`, csvHeader, csvRows);
    } else if (type === 'excel') {
      downloadExcel(`integracao_${name.toLowerCase()}.xlsx`, name, headers, rows);
    } else {
      printTable(`Integracao - ${name}`, headers, rows);
    }
  }

  if (!open) return null;

  const transferAggCount = preview.transfers.filter((t) => { const rt = t.row_type; return rt === 'AGGREGATE' || !rt; }).length;
  const tabs: { key: Tab; label: string; icon: typeof ArrowRightLeft; count: number }[] = [];
  if (preview.transfers.length > 0 || isComparative) {
    tabs.push({ key: 'transfers', label: 'Transferencias', icon: ArrowRightLeft, count: transferAggCount });
  }
  tabs.push({ key: 'adjustments', label: 'Ajustes', icon: ClipboardList, count: adjStats.total });

  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white shrink-0">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">
            Preview da Integracao
          </h2>
          <div className="flex items-center gap-3 mt-1 text-sm text-slate-500">
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
              isComparative ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
            }`}>
              {isComparative ? 'COMPARATIVO' : 'SIMPLES'}
            </span>
            <span>{preview.inventory_a.name} ({preview.inventory_a.warehouse})</span>
            {isComparative && preview.inventory_b && (
              <>
                <ArrowRightLeft className="w-3.5 h-3.5" />
                <span>{preview.inventory_b.name} ({preview.inventory_b.warehouse})</span>
              </>
            )}
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 px-6 py-4 bg-slate-50 border-b border-slate-200 shrink-0">
        <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3">
          <div className="p-2 bg-purple-100 rounded-lg">
            <ArrowRightLeft className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <p className="text-xs text-slate-500">Transferencias</p>
            <p className="text-xl font-bold text-slate-800">{preview.transfers.filter((t) => { const rt = t.row_type; return rt === 'AGGREGATE' || !rt; }).length}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Package className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <p className="text-xs text-slate-500">Ajustes</p>
            <p className="text-xl font-bold text-slate-800">{adjStats.total}</p>
            <div className="flex gap-2 text-[10px] mt-0.5">
              <span className="text-green-600">+{adjStats.entradas} entrada</span>
              <span className="text-red-600">-{adjStats.saidas} saida</span>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3">
          <div className="p-2 bg-green-100 rounded-lg">
            <DollarSign className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <p className="text-xs text-slate-500">Valor Transferencias</p>
            <p className="text-lg font-bold text-slate-800">{fmtMoney(preview.summary.total_transfer_value)}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3">
          <div className="p-2 bg-amber-100 rounded-lg">
            <DollarSign className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <p className="text-xs text-slate-500">Valor Ajustes</p>
            <p className="text-lg font-bold text-slate-800">{fmtMoney(preview.summary.total_adjustment_value)}</p>
          </div>
        </div>
      </div>

      {/* Tabs + Export */}
      <div className="flex items-center justify-between px-6 pt-3 pb-0 border-b border-slate-200 shrink-0">
        <div className="flex gap-1 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  isActive
                    ? 'border-capul-600 text-capul-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
                <span className={`px-1.5 py-0.5 rounded-full text-xs ${
                  isActive ? 'bg-capul-100 text-capul-700' : 'bg-slate-100 text-slate-500'
                }`}>
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>
        <ExportDropdown
          onCSV={() => handleExport('csv')}
          onExcel={() => handleExport('excel')}
          onPrint={() => handleExport('print')}
        />
      </div>

      {/* Table content */}
      <div className="flex-1 overflow-auto px-6 py-4">
        {activeTab === 'transfers' ? (
          <TransfersTable transfers={preview.transfers} />
        ) : (
          <AdjustmentsTable adjustments={preview.adjustments} />
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-white shrink-0">
        <p className="text-xs text-slate-400">
          {preview.existing_integration
            ? `Integracao existente (v${preview.existing_integration.version}) sera atualizada`
            : 'Nova integracao sera criada'}
        </p>
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            onClick={onSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-capul-600 rounded-lg hover:bg-capul-700 disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            Salvar e Enviar
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// === Lot Sub-Rows for Adjustments ===

function AdjustmentLotSubRows({ lots }: { lots: IntegrationAdjustment[] }) {
  const divergentCount = lots.filter((l) => l.adjustment_type !== 'NO_CHANGE').length;
  return (
    <tr>
      <td colSpan={8} className="p-0">
        <div className="bg-slate-50/80 border-t border-slate-200 px-6 py-2">
          <div className="flex items-center gap-2 mb-2">
            <Layers className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-xs font-medium text-slate-600">Detalhamento por Lote</span>
            <span className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded-full font-medium">
              {lots.length} lote(s)
            </span>
            {divergentCount > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded-full font-medium">
                {divergentCount} com ajuste
              </span>
            )}
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-slate-500">
                <th className="text-left py-1 px-2 font-medium">Lote</th>
                <th className="text-right py-1 px-2 font-medium">Esperado</th>
                <th className="text-right py-1 px-2 font-medium">Contado</th>
                <th className="text-right py-1 px-2 font-medium">Ajuste</th>
                <th className="text-center py-1 px-2 font-medium">Situacao</th>
                <th className="text-right py-1 px-2 font-medium">Custo Unit.</th>
                <th className="text-right py-1 px-2 font-medium">Valor</th>
              </tr>
            </thead>
            <tbody>
              {lots.map((l, i) => {
                const isNoChange = l.adjustment_type === 'NO_CHANGE';
                return (
                  <tr
                    key={`${l.lot_number}-${i}`}
                    className={
                      isNoChange ? '' :
                      l.adjustment_type === 'DECREASE' ? 'bg-red-50/50' : 'bg-green-50/50'
                    }
                  >
                    <td className="py-1 px-2 font-mono text-slate-600">{l.lot_number ?? '—'}</td>
                    <td className="py-1 px-2 text-right tabular-nums">{fmtQty(l.expected_qty)}</td>
                    <td className="py-1 px-2 text-right tabular-nums">{fmtQty(l.counted_qty)}</td>
                    <td className={`py-1 px-2 text-right font-medium tabular-nums ${l.adjustment_qty > 0 ? 'text-green-600' : l.adjustment_qty < 0 ? 'text-red-600' : 'text-slate-400'}`}>
                      {l.adjustment_qty > 0 ? '+' : ''}{fmtQty(l.adjustment_qty)}
                    </td>
                    <td className="py-1 px-2 text-center">
                      <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${adjTypeBadgeClass(l.adjustment_type)}`}>
                        {adjTypeLabel(l.adjustment_type)}
                      </span>
                    </td>
                    <td className="py-1 px-2 text-right text-slate-500 tabular-nums">{fmtMoney(l.unit_cost)}</td>
                    <td className="py-1 px-2 text-right font-medium tabular-nums">{fmtMoney(l.total_value)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </td>
    </tr>
  );
}

// === Lot Sub-Rows for Transfers ===

function TransferLotSubRows({ lots }: { lots: IntegrationTransfer[] }) {
  return (
    <tr>
      <td colSpan={6} className="p-0">
        <div className="bg-slate-50/80 border-t border-slate-200 px-6 py-2">
          <div className="flex items-center gap-2 mb-2">
            <Layers className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-xs font-medium text-slate-600">Detalhamento por Lote</span>
            <span className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded-full font-medium">
              {lots.length} lote(s)
            </span>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-slate-500">
                <th className="text-left py-1 px-2 font-medium">Lote</th>
                <th className="text-right py-1 px-2 font-medium">Quantidade</th>
                <th className="text-right py-1 px-2 font-medium">Custo Unit.</th>
                <th className="text-right py-1 px-2 font-medium">Valor</th>
              </tr>
            </thead>
            <tbody>
              {lots.map((l, i) => (
                <tr key={`${l.lot_number}-${i}`} className="bg-purple-50/50">
                  <td className="py-1 px-2 font-mono text-slate-600">{l.lot_number ?? '—'}</td>
                  <td className="py-1 px-2 text-right tabular-nums font-medium">{fmtQty(l.quantity)}</td>
                  <td className="py-1 px-2 text-right text-slate-500 tabular-nums">{fmtMoney(l.unit_cost)}</td>
                  <td className="py-1 px-2 text-right font-medium tabular-nums">{fmtMoney(l.total_value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </td>
    </tr>
  );
}

// === Adjustments Table (grouped by product) ===

function AdjustmentsTable({ adjustments }: { adjustments: IntegrationAdjustment[] }) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const toggleExpand = (key: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const grouped = useMemo(() => groupAdjustments(adjustments), [adjustments]);

  const stats = useMemo(() => {
    const entradas = grouped.filter((g) => g.group_type === 'INCREASE').length;
    const saidas = grouped.filter((g) => g.group_type === 'DECREASE').length;
    const mistos = grouped.filter((g) => g.group_type === 'MIXED').length;
    const ok = grouped.filter((g) => g.group_type === 'NO_CHANGE').length;
    return { total: grouped.length, entradas, saidas, mistos, ok };
  }, [grouped]);

  if (adjustments.length === 0) {
    return (
      <div className="text-center py-12 text-slate-400">
        <ClipboardList className="w-10 h-10 mx-auto mb-2" />
        <p>Nenhum ajuste identificado.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 mb-1">Total Produtos</p>
          <p className="text-2xl font-bold text-slate-800">{stats.total}</p>
          <p className="text-xs text-slate-400">{adjustments.length} movimentacoes</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 className="w-4 h-4 text-green-500" />
            <p className="text-xs text-slate-500">Sem Ajuste</p>
          </div>
          <p className="text-2xl font-bold text-green-600">{stats.ok}</p>
          <p className="text-xs text-slate-400">contagem = sistema</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-blue-500" />
            <p className="text-xs text-slate-500">Entradas</p>
          </div>
          <p className="text-2xl font-bold text-blue-600">{stats.entradas}</p>
          <p className="text-xs text-slate-400">sobra de estoque</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingDown className="w-4 h-4 text-red-500" />
            <p className="text-xs text-slate-500">Saidas</p>
          </div>
          <p className="text-2xl font-bold text-red-600">{stats.saidas}</p>
          <p className="text-xs text-slate-400">falta de estoque</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <p className="text-xs text-slate-500">Mistos</p>
          </div>
          <p className="text-2xl font-bold text-amber-600">{stats.mistos}</p>
          <p className="text-xs text-slate-400">lotes divergentes</p>
        </div>
      </div>

      {/* Distribution bar */}
      {stats.total > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-sm font-medium text-slate-700 mb-3">Distribuicao dos Ajustes</p>
          <div className="flex h-4 rounded-full overflow-hidden bg-slate-200">
            {stats.ok > 0 && (
              <div className="bg-green-500 transition-all" style={{ width: `${(stats.ok / stats.total) * 100}%` }} title={`OK: ${stats.ok}`} />
            )}
            {stats.entradas > 0 && (
              <div className="bg-blue-500 transition-all" style={{ width: `${(stats.entradas / stats.total) * 100}%` }} title={`Entrada: ${stats.entradas}`} />
            )}
            {stats.saidas > 0 && (
              <div className="bg-red-400 transition-all" style={{ width: `${(stats.saidas / stats.total) * 100}%` }} title={`Saida: ${stats.saidas}`} />
            )}
            {stats.mistos > 0 && (
              <div className="bg-amber-400 transition-all" style={{ width: `${(stats.mistos / stats.total) * 100}%` }} title={`Misto: ${stats.mistos}`} />
            )}
          </div>
          <div className="flex gap-4 mt-2 text-xs text-slate-500">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-green-500" /> OK ({stats.ok})</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Entrada ({stats.entradas})</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-400" /> Saida ({stats.saidas})</span>
            {stats.mistos > 0 && (
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-400" /> Misto ({stats.mistos})</span>
            )}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left py-2.5 px-3 font-medium text-slate-600">Codigo</th>
              <th className="text-left py-2.5 px-3 font-medium text-slate-600">Descricao</th>
              <th className="text-left py-2.5 px-3 font-medium text-slate-600">Armazem</th>
              <th className="text-right py-2.5 px-3 font-medium text-slate-600" title="Saldo do sistema (b2_qatu) sem entrega posterior">Saldo Sistema</th>
              <th className="text-right py-2.5 px-3 font-medium text-slate-600" title="Contagem fisica descontando entrega posterior">Contagem Ajust.</th>
              <th className="text-right py-2.5 px-3 font-medium text-slate-600">Ajuste</th>
              <th className="text-center py-2.5 px-3 font-medium text-slate-600">Situacao</th>
              <th className="text-right py-2.5 px-3 font-medium text-slate-600">Valor Total</th>
            </tr>
          </thead>
          <tbody>
            {grouped.map((g) => {
              const key = `${g.product_code}__${g.warehouse}`;
              const isExpanded = expandedRows.has(key);
              const canExpand = g.has_lots && g.lots.length > 1;

              return (
                <React.Fragment key={key}>
                  <tr
                    className={`border-b border-slate-100 ${adjTypeRowBg(g.group_type)} ${canExpand ? 'cursor-pointer hover:bg-slate-50/80' : 'hover:bg-slate-50'}`}
                    onClick={canExpand ? () => toggleExpand(key) : undefined}
                  >
                    <td className="py-2.5 px-3 font-mono text-slate-700">
                      <div className="flex items-center gap-1.5">
                        {canExpand && (
                          isExpanded
                            ? <ChevronDown className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                            : <ChevronRight className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                        )}
                        {g.product_code}
                        {canExpand && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded text-[10px] font-medium">
                            <Layers className="w-3 h-3" />{g.lots.length}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-slate-800 max-w-[250px]">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate">{g.product_description}</span>
                        {g.b2_xentpos > 0 && (
                          <span
                            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-orange-50 text-orange-600 rounded text-[10px] font-medium whitespace-nowrap flex-shrink-0"
                            title={`Entrega posterior: ${fmtQty(g.b2_xentpos)} (descontado da contagem para Protheus)`}
                          >
                            <Info className="w-3 h-3" />EP: {fmtQty(g.b2_xentpos)}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-600">{g.warehouse}</td>
                    <td className="py-2.5 px-3 text-right text-slate-600">{fmtQty(g.total_expected)}</td>
                    <td className="py-2.5 px-3 text-right text-slate-600">{fmtQty(g.total_counted)}</td>
                    <td className={`py-2.5 px-3 text-right font-medium ${g.total_adjustment > 0 ? 'text-green-600' : g.total_adjustment < 0 ? 'text-red-600' : 'text-slate-400'}`}>
                      {g.total_adjustment > 0 ? '+' : ''}{fmtQty(g.total_adjustment)}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${adjTypeBadgeClass(g.group_type)}`}>
                        {adjTypeIcon(g.group_type)}
                        {adjTypeLabel(g.group_type)}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-medium text-slate-800">{fmtMoney(g.total_value)}</td>
                  </tr>
                  {canExpand && isExpanded && <AdjustmentLotSubRows lots={g.lots} />}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// === Transfers Table (grouped by product) ===

function TransfersTable({ transfers }: { transfers: IntegrationTransfer[] }) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const toggleExpand = (key: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const grouped = useMemo(() => groupTransfers(transfers), [transfers]);

  if (transfers.length === 0) {
    return (
      <div className="text-center py-12 text-slate-400">
        <ArrowRightLeft className="w-10 h-10 mx-auto mb-2" />
        <p>Nenhuma transferencia identificada.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 mb-1">Produtos</p>
          <p className="text-2xl font-bold text-slate-800">{grouped.length}</p>
          <p className="text-xs text-slate-400">{transfers.length} movimentacoes</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            <ArrowRightLeft className="w-4 h-4 text-purple-500" />
            <p className="text-xs text-slate-500">Qtd Total</p>
          </div>
          <p className="text-2xl font-bold text-purple-600">
            {fmtQty(grouped.reduce((s, g) => s + g.total_quantity, 0))}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="w-4 h-4 text-green-500" />
            <p className="text-xs text-slate-500">Valor Total</p>
          </div>
          <p className="text-2xl font-bold text-green-600">
            {fmtMoney(grouped.reduce((s, g) => s + g.total_value, 0))}
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left py-2.5 px-3 font-medium text-slate-600">Codigo</th>
              <th className="text-left py-2.5 px-3 font-medium text-slate-600">Descricao</th>
              <th className="text-left py-2.5 px-3 font-medium text-slate-600">Origem</th>
              <th className="text-left py-2.5 px-3 font-medium text-slate-600">Destino</th>
              <th className="text-right py-2.5 px-3 font-medium text-slate-600">Quantidade</th>
              <th className="text-right py-2.5 px-3 font-medium text-slate-600">Valor Total</th>
            </tr>
          </thead>
          <tbody>
            {grouped.map((g) => {
              const key = `${g.product_code}__${g.source_warehouse}__${g.target_warehouse}`;
              const isExpanded = expandedRows.has(key);
              const canExpand = g.has_lots && g.lots.length > 1;

              return (
                <React.Fragment key={key}>
                  <tr
                    className={`border-b border-slate-100 bg-purple-50/20 ${canExpand ? 'cursor-pointer hover:bg-slate-50/80' : 'hover:bg-slate-50'}`}
                    onClick={canExpand ? () => toggleExpand(key) : undefined}
                  >
                    <td className="py-2.5 px-3 font-mono text-slate-700">
                      <div className="flex items-center gap-1.5">
                        {canExpand && (
                          isExpanded
                            ? <ChevronDown className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                            : <ChevronRight className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                        )}
                        {g.product_code}
                        {canExpand && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded text-[10px] font-medium">
                            <Layers className="w-3 h-3" />{g.lots.length}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-slate-800 truncate max-w-[200px]">{g.product_description}</td>
                    <td className="py-2.5 px-3 font-mono text-slate-600">{g.source_warehouse}</td>
                    <td className="py-2.5 px-3 font-mono text-slate-600">{g.target_warehouse}</td>
                    <td className="py-2.5 px-3 text-right font-medium text-slate-700">{fmtQty(g.total_quantity)}</td>
                    <td className="py-2.5 px-3 text-right font-medium text-slate-800">{fmtMoney(g.total_value)}</td>
                  </tr>
                  {canExpand && isExpanded && <TransferLotSubRows lots={g.lots} />}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
