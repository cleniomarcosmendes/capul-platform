import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

type Variant = 'primary' | 'danger' | 'secondary' | 'success';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-capul-600 text-white hover:bg-capul-700',
  success: 'bg-emerald-600 text-white hover:bg-emerald-700',
  danger: 'bg-red-600 text-white hover:bg-red-700',
  secondary: 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
};

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  loading?: boolean;
  children: ReactNode;
}

/** Botão padrão do módulo Logística — variantes consistentes + estado loading. */
export function Button({ variant = 'primary', loading = false, disabled, className = '', children, ...rest }: Props) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${VARIANTS[variant]} ${className}`}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}
