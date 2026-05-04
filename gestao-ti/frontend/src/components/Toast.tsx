import { useEffect, useState, useCallback, useRef, createContext, useContext } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
}

interface ConfirmState {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'default';
  resolve: (value: boolean) => void;
}

interface PromptState {
  title: string;
  message: string;
  placeholder?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'default';
  required?: boolean;
  multiline?: boolean;
  resolve: (value: string | null) => void;
}

interface ToastContextType {
  toast: (type: ToastType, message: string) => void;
  confirm: (title: string, message: string, options?: { confirmLabel?: string; cancelLabel?: string; variant?: 'danger' | 'warning' | 'default' }) => Promise<boolean>;
  prompt: (title: string, message: string, options?: { placeholder?: string; confirmLabel?: string; cancelLabel?: string; variant?: 'danger' | 'warning' | 'default'; required?: boolean; multiline?: boolean }) => Promise<string | null>;
}

const ToastContext = createContext<ToastContextType>({
  toast: () => {},
  confirm: () => Promise.resolve(false),
  prompt: () => Promise.resolve(null),
});

const icons: Record<ToastType, typeof Info> = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const styles: Record<ToastType, string> = {
  success: 'bg-green-50 border-green-300 text-green-800',
  error: 'bg-red-50 border-red-300 text-red-800',
  warning: 'bg-amber-50 border-amber-300 text-amber-800',
  info: 'bg-blue-50 border-blue-300 text-blue-800',
};

const iconStyles: Record<ToastType, string> = {
  success: 'text-green-500',
  error: 'text-red-500',
  warning: 'text-amber-500',
  info: 'text-blue-500',
};

const confirmBtnStyles: Record<string, string> = {
  danger: 'bg-red-600 hover:bg-red-700 text-white',
  warning: 'bg-amber-500 hover:bg-amber-600 text-white',
  default: 'bg-capul-600 hover:bg-capul-700 text-white',
};

let nextId = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const [promptState, setPromptState] = useState<PromptState | null>(null);

  const addToast = useCallback((type: ToastType, message: string) => {
    const id = ++nextId;
    setToasts((prev) => [...prev, { id, type, message }]);
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showConfirm = useCallback((title: string, message: string, options?: { confirmLabel?: string; cancelLabel?: string; variant?: 'danger' | 'warning' | 'default' }) => {
    return new Promise<boolean>((resolve) => {
      setConfirmState({ title, message, resolve, ...options });
    });
  }, []);

  const handleConfirm = useCallback((value: boolean) => {
    confirmState?.resolve(value);
    setConfirmState(null);
  }, [confirmState]);

  const showPrompt = useCallback((title: string, message: string, options?: { placeholder?: string; confirmLabel?: string; cancelLabel?: string; variant?: 'danger' | 'warning' | 'default'; required?: boolean; multiline?: boolean }) => {
    return new Promise<string | null>((resolve) => {
      setPromptState({ title, message, resolve, ...options });
    });
  }, []);

  const handlePrompt = useCallback((value: string | null) => {
    promptState?.resolve(value);
    setPromptState(null);
  }, [promptState]);

  return (
    <ToastContext.Provider value={{ toast: addToast, confirm: showConfirm, prompt: showPrompt }}>
      {children}

      {/* Toasts */}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-3 pointer-events-none">
        {toasts.map((t) => (
          <ToastMessage key={t.id} item={t} onClose={() => removeToast(t.id)} />
        ))}
      </div>

      {/* Confirm Modal */}
      {confirmState && (
        <ConfirmModal state={confirmState} onClose={handleConfirm} />
      )}

      {/* Prompt Modal */}
      {promptState && (
        <PromptModal state={promptState} onClose={handlePrompt} />
      )}
    </ToastContext.Provider>
  );
}

function ToastMessage({ item, onClose }: { item: ToastItem; onClose: () => void }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onClose, 300);
    }, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const Icon = icons[item.type];

  return (
    <div
      className={`pointer-events-auto flex items-start gap-3 min-w-[320px] max-w-[480px] px-4 py-3 rounded-xl border shadow-lg backdrop-blur-sm transition-all duration-300 ${styles[item.type]} ${
        visible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-8'
      }`}
    >
      <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${iconStyles[item.type]}`} />
      <p className="text-sm font-medium flex-1">{item.message}</p>
      <button onClick={() => { setVisible(false); setTimeout(onClose, 300); }} className="flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

function ConfirmModal({ state, onClose }: { state: ConfirmState; onClose: (v: boolean) => void }) {
  const [visible, setVisible] = useState(false);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);
  const variant = state.variant || 'danger';

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
    confirmBtnRef.current?.focus();
  }, []);

  const handleClose = (value: boolean) => {
    setVisible(false);
    setTimeout(() => onClose(value), 200);
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const VariantIcon = variant === 'danger' ? XCircle : variant === 'warning' ? AlertTriangle : Info;
  const iconColor = variant === 'danger' ? 'text-red-500 bg-red-100' : variant === 'warning' ? 'text-amber-500 bg-amber-100' : 'text-blue-500 bg-blue-100';

  return (
    <div className={`fixed inset-0 z-[9998] flex items-center justify-center transition-all duration-200 ${visible ? 'opacity-100' : 'opacity-0'}`}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => handleClose(false)} />
      <div className={`relative bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 transition-all duration-200 ${visible ? 'scale-100 translate-y-0' : 'scale-95 translate-y-4'}`}>
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${iconColor}`}>
              <VariantIcon className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-semibold text-slate-800">{state.title}</h3>
              <p className="text-sm text-slate-500 mt-1">{state.message}</p>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 bg-slate-50 rounded-b-2xl border-t border-slate-100">
          <button
            onClick={() => handleClose(false)}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
          >
            {state.cancelLabel || 'Cancelar'}
          </button>
          <button
            ref={confirmBtnRef}
            onClick={() => handleClose(true)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${confirmBtnStyles[variant]}`}
          >
            {state.confirmLabel || 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  );
}

function PromptModal({ state, onClose }: { state: PromptState; onClose: (v: string | null) => void }) {
  const [visible, setVisible] = useState(false);
  const [valor, setValor] = useState('');
  const inputRef = useRef<HTMLTextAreaElement | HTMLInputElement>(null);
  const variant = state.variant || 'default';
  const multiline = state.multiline ?? true;

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
    inputRef.current?.focus();
  }, []);

  const handleClose = (value: string | null) => {
    setVisible(false);
    setTimeout(() => onClose(value), 200);
  };

  const handleConfirm = () => {
    const trimmed = valor.trim();
    if (state.required && !trimmed) {
      inputRef.current?.focus();
      return;
    }
    handleClose(trimmed || (state.required ? '' : null));
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose(null);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const VariantIcon = variant === 'danger' ? XCircle : variant === 'warning' ? AlertTriangle : Info;
  const iconColor = variant === 'danger' ? 'text-red-500 bg-red-100' : variant === 'warning' ? 'text-amber-500 bg-amber-100' : 'text-blue-500 bg-blue-100';

  return (
    <div className={`fixed inset-0 z-[9998] flex items-center justify-center transition-all duration-200 ${visible ? 'opacity-100' : 'opacity-0'}`}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => handleClose(null)} />
      <div className={`relative bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 transition-all duration-200 ${visible ? 'scale-100 translate-y-0' : 'scale-95 translate-y-4'}`}>
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${iconColor}`}>
              <VariantIcon className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-semibold text-slate-800">{state.title}</h3>
              <p className="text-sm text-slate-500 mt-1">{state.message}</p>
            </div>
          </div>
          <div className="mt-4">
            {multiline ? (
              <textarea
                ref={inputRef as React.RefObject<HTMLTextAreaElement>}
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                placeholder={state.placeholder ?? 'Digite aqui...'}
                rows={3}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-capul-500 focus:border-transparent resize-none"
                onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleConfirm(); }}
              />
            ) : (
              <input
                ref={inputRef as React.RefObject<HTMLInputElement>}
                type="text"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                placeholder={state.placeholder ?? 'Digite aqui...'}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-capul-500 focus:border-transparent"
                onKeyDown={(e) => { if (e.key === 'Enter') handleConfirm(); }}
              />
            )}
            {state.required && (
              <p className="text-xs text-slate-400 mt-1">Campo obrigatório</p>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 bg-slate-50 rounded-b-2xl border-t border-slate-100">
          <button
            onClick={() => handleClose(null)}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
          >
            {state.cancelLabel || 'Cancelar'}
          </button>
          <button
            onClick={handleConfirm}
            disabled={state.required && !valor.trim()}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${confirmBtnStyles[variant]}`}
          >
            {state.confirmLabel || 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
