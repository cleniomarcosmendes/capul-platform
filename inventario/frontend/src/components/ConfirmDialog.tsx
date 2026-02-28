import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Info, X } from 'lucide-react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  details?: string[];
  variant?: 'warning' | 'danger' | 'info';
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const variantConfig = {
  warning: {
    icon: AlertTriangle,
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-600',
    buttonBg: 'bg-amber-600 hover:bg-amber-700 focus-visible:ring-amber-500',
  },
  danger: {
    icon: AlertTriangle,
    iconBg: 'bg-red-100',
    iconColor: 'text-red-600',
    buttonBg: 'bg-red-600 hover:bg-red-700 focus-visible:ring-red-500',
  },
  info: {
    icon: Info,
    iconBg: 'bg-capul-100',
    iconColor: 'text-capul-600',
    buttonBg: 'bg-capul-600 hover:bg-capul-700 focus-visible:ring-capul-500',
  },
};

export function ConfirmDialog({
  open,
  title,
  description,
  details,
  variant = 'warning',
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) {
      confirmRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onCancel]);

  if (!open) return null;

  const cfg = variantConfig[variant];
  const Icon = cfg.icon;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onCancel}
      />

      {/* Dialog — z-10 garante que fica acima do backdrop */}
      <div
        className="relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onCancel}
          className="absolute top-3 right-3 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="p-6">
          {/* Icon + Title */}
          <div className="flex items-start gap-4">
            <div className={`p-3 rounded-xl ${cfg.iconBg} shrink-0`}>
              <Icon className={`w-6 h-6 ${cfg.iconColor}`} />
            </div>
            <div className="min-w-0 pt-0.5">
              <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
              {description && (
                <p className="text-sm text-slate-500 mt-1 leading-relaxed">{description}</p>
              )}
            </div>
          </div>

          {/* Details list */}
          {details && details.length > 0 && (
            <div className="mt-4 ml-[3.75rem] bg-slate-50 rounded-lg p-3 space-y-1">
              {details.map((d, i) => (
                <p key={i} className="text-sm text-slate-600">{d}</p>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 px-6 pb-6">
          <button
            onClick={onCancel}
            className="px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            onClick={onConfirm}
            className={`px-5 py-2.5 text-sm font-medium text-white rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 transition-colors ${cfg.buttonBg}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
