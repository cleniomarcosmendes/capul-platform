import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Pencil, X } from 'lucide-react';

type InputKind = 'text' | 'number' | 'textarea';

interface PromptDialogProps {
  open: boolean;
  title: string;
  description?: string;
  label?: string;
  placeholder?: string;
  initialValue?: string;
  inputType?: InputKind;
  /** Linhas iniciais quando inputType='textarea'. Default 4. */
  rows?: number;
  /** Limite de caracteres exibido (UX). Não força no servidor. */
  maxLength?: number;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Quando true, exige valor não vazio. Default false (observação opcional). */
  required?: boolean;
  validate?: (value: string) => string | null;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}

/**
 * Modal de input — substituto elegante do `window.prompt` nativo.
 *
 * Prop-based (sem provider) pra seguir o padrão do ConfirmDialog existente.
 * Suporta texto, número e textarea (observação multi-linha).
 *
 * Atalhos: Esc cancela. Enter confirma (em textarea, Ctrl+Enter pra confirmar
 * sem inserir quebra de linha indesejada).
 */
export function PromptDialog({
  open,
  title,
  description,
  label,
  placeholder,
  initialValue = '',
  inputType = 'text',
  rows = 4,
  maxLength,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  required = false,
  validate,
  onConfirm,
  onCancel,
}: PromptDialogProps) {
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
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

  function submit() {
    if (required && !value.trim()) {
      setError('Campo obrigatório.');
      return;
    }
    if (validate) {
      const err = validate(value);
      if (err) {
        setError(err);
        return;
      }
    }
    onConfirm(value);
  }

  function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    submit();
  }

  function handleTextareaKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Ctrl+Enter ou Cmd+Enter confirma sem precisar clicar no botão.
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      submit();
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} />

      <form
        onSubmit={handleFormSubmit}
        className="relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-lg"
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
            <div className="p-3 rounded-xl bg-blue-100 shrink-0">
              <Pencil className="w-6 h-6 text-blue-600" />
            </div>
            <div className="min-w-0 pt-0.5 flex-1">
              <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
              {description && (
                <p className="text-sm text-slate-500 mt-1 leading-relaxed whitespace-pre-line">
                  {description}
                </p>
              )}
            </div>
          </div>

          <div className="mt-4 ml-[3.75rem]">
            {label && (
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {label}
                {!required && (
                  <span className="ml-1 text-xs font-normal text-slate-400">(opcional)</span>
                )}
              </label>
            )}
            {inputType === 'textarea' ? (
              <textarea
                ref={inputRef as React.RefObject<HTMLTextAreaElement>}
                value={value}
                onChange={(e) => {
                  setValue(e.target.value);
                  if (error) setError(null);
                }}
                onKeyDown={handleTextareaKeyDown}
                placeholder={placeholder}
                rows={rows}
                maxLength={maxLength}
                className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-y ${
                  error ? 'border-red-300' : 'border-slate-300'
                }`}
              />
            ) : (
              <input
                ref={inputRef as React.RefObject<HTMLInputElement>}
                type={inputType}
                value={value}
                onChange={(e) => {
                  setValue(e.target.value);
                  if (error) setError(null);
                }}
                placeholder={placeholder}
                step={inputType === 'number' ? 'any' : undefined}
                maxLength={maxLength}
                className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  error ? 'border-red-300' : 'border-slate-300'
                }`}
              />
            )}
            <div className="mt-1 flex items-center justify-between gap-2">
              <p className="text-xs text-red-600">{error ?? ''}</p>
              {maxLength && (
                <p className="text-xs text-slate-400 ml-auto">
                  {value.length}/{maxLength}
                </p>
              )}
            </div>
            {inputType === 'textarea' && (
              <p className="mt-1 text-xs text-slate-400">
                Dica: <kbd className="px-1 py-0.5 bg-slate-100 rounded text-slate-600">Ctrl</kbd>+
                <kbd className="px-1 py-0.5 bg-slate-100 rounded text-slate-600">Enter</kbd> confirma.
              </p>
            )}
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
            className="px-5 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            {confirmLabel}
          </button>
        </div>
      </form>
    </div>,
    document.body,
  );
}
