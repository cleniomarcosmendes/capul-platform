import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  ArrowRightLeft,
  ClipboardList,
  DollarSign,
  Package,
  Loader2,
  Send,
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

  // Export helpers
  const transferHeaders = ['Codigo', 'Descricao', 'Lote', 'Origem', 'Destino', 'Quantidade', 'Custo Unit.', 'Valor Total'];
  const adjustmentHeaders = ['Codigo', 'Descricao', 'Lote', 'Armazem', 'Esperado', 'Contado', 'Ajuste', 'Tipo', 'Custo Unit.', 'Valor Total'];

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
      a.adjustment_type,
      fmtMoney(a.unit_cost),
      fmtMoney(a.total_value),
    ]),
    [preview.adjustments],
  );

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

  const tabs: { key: Tab; label: string; icon: typeof ArrowRightLeft; count: number }[] = [];
  if (preview.transfers.length > 0 || isComparative) {
    tabs.push({ key: 'transfers', label: 'Transferencias', icon: ArrowRightLeft, count: preview.transfers.length });
  }
  tabs.push({ key: 'adjustments', label: 'Ajustes', icon: ClipboardList, count: preview.adjustments.length });

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
            <p className="text-xl font-bold text-slate-800">{preview.summary.total_transfers}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Package className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <p className="text-xs text-slate-500">Ajustes</p>
            <p className="text-xl font-bold text-slate-800">{preview.summary.total_adjustments}</p>
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

// === Sub-components ===

function TransfersTable({ transfers }: { transfers: IntegrationTransfer[] }) {
  if (transfers.length === 0) {
    return (
      <div className="text-center py-12 text-slate-400">
        <ArrowRightLeft className="w-10 h-10 mx-auto mb-2" />
        <p>Nenhuma transferencia identificada.</p>
      </div>
    );
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="bg-slate-50 border-b border-slate-200">
          <th className="text-left py-2.5 px-3 font-medium text-slate-600">Codigo</th>
          <th className="text-left py-2.5 px-3 font-medium text-slate-600">Descricao</th>
          <th className="text-left py-2.5 px-3 font-medium text-slate-600">Lote</th>
          <th className="text-left py-2.5 px-3 font-medium text-slate-600">Origem</th>
          <th className="text-left py-2.5 px-3 font-medium text-slate-600">Destino</th>
          <th className="text-right py-2.5 px-3 font-medium text-slate-600">Qtd</th>
          <th className="text-right py-2.5 px-3 font-medium text-slate-600">Custo Unit.</th>
          <th className="text-right py-2.5 px-3 font-medium text-slate-600">Valor Total</th>
        </tr>
      </thead>
      <tbody>
        {transfers.map((t, i) => (
          <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">
            <td className="py-2 px-3 font-mono text-slate-700">{t.product_code}</td>
            <td className="py-2 px-3 text-slate-700 max-w-[200px] truncate">{t.product_description}</td>
            <td className="py-2 px-3 font-mono text-slate-500">{t.lot_number ?? '—'}</td>
            <td className="py-2 px-3 font-mono text-slate-600">{t.source_warehouse}</td>
            <td className="py-2 px-3 font-mono text-slate-600">{t.target_warehouse}</td>
            <td className="py-2 px-3 text-right font-medium text-slate-700">{fmtQty(t.quantity)}</td>
            <td className="py-2 px-3 text-right text-slate-500">{fmtMoney(t.unit_cost)}</td>
            <td className="py-2 px-3 text-right font-medium text-slate-800">{fmtMoney(t.total_value)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function AdjustmentsTable({ adjustments }: { adjustments: IntegrationAdjustment[] }) {
  if (adjustments.length === 0) {
    return (
      <div className="text-center py-12 text-slate-400">
        <ClipboardList className="w-10 h-10 mx-auto mb-2" />
        <p>Nenhum ajuste identificado.</p>
      </div>
    );
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="bg-slate-50 border-b border-slate-200">
          <th className="text-left py-2.5 px-3 font-medium text-slate-600">Codigo</th>
          <th className="text-left py-2.5 px-3 font-medium text-slate-600">Descricao</th>
          <th className="text-left py-2.5 px-3 font-medium text-slate-600">Lote</th>
          <th className="text-left py-2.5 px-3 font-medium text-slate-600">Armazem</th>
          <th className="text-right py-2.5 px-3 font-medium text-slate-600">Esperado</th>
          <th className="text-right py-2.5 px-3 font-medium text-slate-600">Contado</th>
          <th className="text-right py-2.5 px-3 font-medium text-slate-600">Ajuste</th>
          <th className="text-center py-2.5 px-3 font-medium text-slate-600">Tipo</th>
          <th className="text-right py-2.5 px-3 font-medium text-slate-600">Custo Unit.</th>
          <th className="text-right py-2.5 px-3 font-medium text-slate-600">Valor Total</th>
        </tr>
      </thead>
      <tbody>
        {adjustments.map((a, i) => (
          <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">
            <td className="py-2 px-3 font-mono text-slate-700">{a.product_code}</td>
            <td className="py-2 px-3 text-slate-700 max-w-[200px] truncate">{a.product_description}</td>
            <td className="py-2 px-3 font-mono text-slate-500">{a.lot_number ?? '—'}</td>
            <td className="py-2 px-3 font-mono text-slate-600">{a.warehouse}</td>
            <td className="py-2 px-3 text-right text-slate-600">{fmtQty(a.expected_qty)}</td>
            <td className="py-2 px-3 text-right text-slate-600">{fmtQty(a.counted_qty)}</td>
            <td className={`py-2 px-3 text-right font-medium ${a.adjustment_qty > 0 ? 'text-green-600' : a.adjustment_qty < 0 ? 'text-red-600' : 'text-slate-600'}`}>
              {a.adjustment_qty > 0 ? '+' : ''}{fmtQty(a.adjustment_qty)}
            </td>
            <td className="py-2 px-3 text-center">
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                a.adjustment_type === 'ENTRADA'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-red-100 text-red-700'
              }`}>
                {a.adjustment_type}
              </span>
            </td>
            <td className="py-2 px-3 text-right text-slate-500">{fmtMoney(a.unit_cost)}</td>
            <td className="py-2 px-3 text-right font-medium text-slate-800">{fmtMoney(a.total_value)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
