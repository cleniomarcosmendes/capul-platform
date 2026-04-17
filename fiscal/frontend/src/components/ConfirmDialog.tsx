import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AlertTriangle, Info, Trash2, X } from 'lucide-react';
import { Button } from './Button';

type ConfirmVariant = 'danger' | 'warning' | 'info';

interface ConfirmOptions {
  title: string;
  description: string;
  variant?: ConfirmVariant;
  confirmLabel?: string;
  cancelLabel?: string;
}

interface PendingConfirm extends ConfirmOptions {
  resolve: (result: boolean) => void;
}

interface ConfirmContextValue {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

/**
 * Provider de diálogo de confirmação — substitui `window.confirm()` nativo
 * por um modal centrado, elegante, com variantes visuais para ações destrutivas,
 * de aviso ou informativas.
 *
 * Uso:
 * ```tsx
 * const confirm = useConfirm();
 * const ok = await confirm({
 *   title: 'Remover certificado?',
 *   description: 'Esta ação não pode ser desfeita.',
 *   variant: 'danger',
 *   confirmLabel: 'Remover',
 * });
 * if (ok) { ... }
 * ```
 */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingConfirm | null>(null);

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setPending({ ...options, resolve });
    });
  }, []);

  function handleClose(result: boolean) {
    if (pending) {
      pending.resolve(result);
      setPending(null);
    }
  }

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {pending && <ConfirmModal options={pending} onClose={handleClose} />}
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): (options: ConfirmOptions) => Promise<boolean> {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider');
  return ctx.confirm;
}

function ConfirmModal({
  options,
  onClose,
}: {
  options: ConfirmOptions;
  onClose: (result: boolean) => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);

  // Focus trap + Escape to close: mantém Tab circulando dentro do modal e
  // devolve foco ao elemento que abriu o modal quando fecha.
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;

    // Auto-focus no botão Cancelar (último focusable do footer, mais seguro
    // que confirmar por padrão — previne confirmação acidental com Enter).
    const focusables = dialogRef.current?.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    // O botão cancelar é o último do footer (row-reverse). Buscamos pelo texto
    // ou pegamos o último antes do X (que é o primeiro).
    const cancelButton = Array.from(focusables ?? []).find((el) =>
      el.textContent?.includes(options.cancelLabel ?? 'Cancelar'),
    );
    cancelButton?.focus();

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose(false);
        return;
      }
      if (e.key !== 'Tab') return;

      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable || focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement;

      if (e.shiftKey && active === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first?.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [onClose, options.cancelLabel]);

  const variant = options.variant ?? 'info';
  const scheme = {
    danger: {
      iconBg: 'bg-red-100',
      iconColor: 'text-red-600',
      icon: <Trash2 className="h-6 w-6" />,
      buttonVariant: 'danger' as const,
    },
    warning: {
      iconBg: 'bg-amber-100',
      iconColor: 'text-amber-600',
      icon: <AlertTriangle className="h-6 w-6" />,
      buttonVariant: 'primary' as const,
    },
    info: {
      iconBg: 'bg-blue-100',
      iconColor: 'text-blue-600',
      icon: <Info className="h-6 w-6" />,
      buttonVariant: 'primary' as const,
    },
  }[variant];

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4 animate-in fade-in duration-200"
      onClick={() => onClose(false)}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-description"
        className="w-full max-w-md rounded-xl bg-white shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div
              className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full ${scheme.iconBg} ${scheme.iconColor}`}
            >
              {scheme.icon}
            </div>
            <div className="flex-1 pt-1">
              <h3 id="confirm-title" className="text-base font-semibold text-slate-900">
                {options.title}
              </h3>
              <p id="confirm-description" className="mt-2 text-sm leading-relaxed text-slate-600">
                {options.description}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onClose(false)}
              className="flex-shrink-0 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="flex flex-row-reverse gap-2 border-t border-slate-100 bg-slate-50 px-6 py-4">
          <Button variant={scheme.buttonVariant} size="sm" onClick={() => onClose(true)}>
            {options.confirmLabel ?? 'Confirmar'}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => onClose(false)}>
            {options.cancelLabel ?? 'Cancelar'}
          </Button>
        </div>
      </div>
    </div>
  );
}
