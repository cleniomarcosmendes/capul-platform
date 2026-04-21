import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { AlertCircle, CheckCircle2, Info, X, AlertTriangle } from 'lucide-react';

type ToastVariant = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: number;
  variant: ToastVariant;
  title: string;
  description?: string;
  duration: number;
}

interface ToastContextValue {
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
  warning: (title: string, description?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

/**
 * Provider de notificações toast — substitui `alert()` nativo por notificações
 * flutuantes elegantes que aparecem no canto inferior direito e somem sozinhas.
 *
 * Uso:
 * ```tsx
 * const toast = useToast();
 * toast.success('Certificado ativado', 'Pode prosseguir com as consultas');
 * toast.error('Falha', 'Tente novamente em alguns minutos');
 * ```
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dispatch = useCallback((variant: ToastVariant, title: string, description?: string) => {
    const id = Date.now() + Math.random();
    const duration = variant === 'error' || variant === 'warning' ? 6000 : 4000;
    setToasts((prev) => [...prev, { id, variant, title, description, duration }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  }, []);

  const value: ToastContextValue = {
    success: (t, d) => dispatch('success', t, d),
    error: (t, d) => dispatch('error', t, d),
    info: (t, d) => dispatch('info', t, d),
    warning: (t, d) => dispatch('warning', t, d),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-3 pointer-events-none max-w-md">
        {toasts.map((t) => (
          <ToastItem
            key={t.id}
            toast={t}
            onClose={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const scheme = {
    success: {
      bg: 'bg-emerald-50 border-emerald-200',
      titleColor: 'text-emerald-900',
      descColor: 'text-emerald-700',
      icon: <CheckCircle2 className="h-5 w-5 text-emerald-600" />,
    },
    error: {
      bg: 'bg-red-50 border-red-200',
      titleColor: 'text-red-900',
      descColor: 'text-red-700',
      icon: <AlertCircle className="h-5 w-5 text-red-600" />,
    },
    info: {
      bg: 'bg-blue-50 border-blue-200',
      titleColor: 'text-blue-900',
      descColor: 'text-blue-700',
      icon: <Info className="h-5 w-5 text-blue-600" />,
    },
    warning: {
      bg: 'bg-amber-50 border-amber-200',
      titleColor: 'text-amber-900',
      descColor: 'text-amber-700',
      icon: <AlertTriangle className="h-5 w-5 text-amber-600" />,
    },
  }[toast.variant];

  return (
    <div
      className={`pointer-events-auto flex items-start gap-3 rounded-lg border ${scheme.bg} p-4 shadow-lg animate-in slide-in-from-right-5`}
      style={{ animation: 'slideIn 0.25s ease-out' }}
    >
      <div className="flex-shrink-0 mt-0.5">{scheme.icon}</div>
      <div className="flex-1 min-w-0">
        <div className={`text-sm font-semibold ${scheme.titleColor}`}>{toast.title}</div>
        {toast.description && (
          <div className={`mt-0.5 text-xs ${scheme.descColor}`}>{toast.description}</div>
        )}
      </div>
      <button
        type="button"
        onClick={onClose}
        className={`flex-shrink-0 rounded-md p-0.5 ${scheme.titleColor} hover:bg-black/5 transition-colors`}
        aria-label="Fechar notificação"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
