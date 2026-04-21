import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Pencil, X } from 'lucide-react';

interface PromptDialogProps {
  open: boolean;
  title: string;
  description?: string;
  label?: string;
  placeholder?: string;
  initialValue?: string;
  inputType?: 'text' | 'number';
  confirmLabel?: string;
  cancelLabel?: string;
  validate?: (value: string) => string | null;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}

/**
 * Modal de input de linha unica — substituto elegante do window.prompt nativo.
 * Prop-based (sem provider) pra seguir o padrao do ConfirmDialog existente.
 */
export function PromptDialog({
  open,
  title,
  description,
  label,
  placeholder,
  initialValue = '',
  inputType = 'text',
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  validate,
  onConfirm,
  onCancel,
}: PromptDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setValue(initialValue);
      setError(null);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open, initialValue]);

  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onCancel]);

  if (!open) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (validate) {
      const err = validate(value);
      if (err) {
        setError(err);
        return;
      }
    }
    onConfirm(value);
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} />

      <form
        onSubmit={handleSubmit}
        className="relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-md"
      >
        <button
          type="button"
          onClick={onCancel}
          className="absolute top-3 right-3 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-capul-100 shrink-0">
              <Pencil className="w-6 h-6 text-capul-600" />
            </div>
            <div className="min-w-0 pt-0.5 flex-1">
              <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
              {description && (
                <p className="text-sm text-slate-500 mt-1 leading-relaxed">{description}</p>
              )}
            </div>
          </div>

          <div className="mt-4 ml-[3.75rem]">
            {label && <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>}
            <input
              ref={inputRef}
              type={inputType}
              value={value}
              onChange={(e) => { setValue(e.target.value); if (error) setError(null); }}
              placeholder={placeholder}
              step={inputType === 'number' ? 'any' : undefined}
              className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-capul-500 focus:border-capul-500 ${
                error ? 'border-red-300' : 'border-slate-300'
              }`}
            />
            {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 pb-6">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            type="submit"
            className="px-5 py-2.5 text-sm font-medium text-white bg-capul-600 rounded-lg hover:bg-capul-700 transition-colors"
          >
            {confirmLabel}
          </button>
        </div>
      </form>
    </div>,
    document.body,
  );
}
