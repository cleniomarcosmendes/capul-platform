import { createContext, useContext } from 'react';

// Contexto + hook do Toast/Confirm/Prompt, separados do componente ToastProvider
// (Toast.tsx) para que o arquivo de componente exporte só componentes — exigência
// do Fast Refresh do Vite (react-refresh/only-export-components).

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastContextType {
  toast: (type: ToastType, message: string) => void;
  confirm: (title: string, message: string, options?: { confirmLabel?: string; cancelLabel?: string; variant?: 'danger' | 'warning' | 'default' }) => Promise<boolean>;
  prompt: (title: string, message: string, options?: { placeholder?: string; confirmLabel?: string; cancelLabel?: string; variant?: 'danger' | 'warning' | 'default'; required?: boolean; multiline?: boolean }) => Promise<string | null>;
}

export const ToastContext = createContext<ToastContextType>({
  toast: () => {},
  confirm: () => Promise.resolve(false),
  prompt: () => Promise.resolve(null),
});

export function useToast() {
  return useContext(ToastContext);
}
