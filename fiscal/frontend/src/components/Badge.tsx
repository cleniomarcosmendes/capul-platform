import type { ReactNode } from 'react';

type Variant = 'gray' | 'blue' | 'green' | 'yellow' | 'red' | 'purple';

interface BadgeProps {
  variant?: Variant;
  children: ReactNode;
  className?: string;
}

const VARIANT_CLASSES: Record<Variant, string> = {
  gray: 'bg-slate-100 text-slate-700 ring-slate-200',
  blue: 'bg-blue-50 text-blue-700 ring-blue-200',
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  yellow: 'bg-amber-50 text-amber-700 ring-amber-200',
  red: 'bg-red-50 text-red-700 ring-red-200',
  purple: 'bg-violet-50 text-violet-700 ring-violet-200',
};

export function Badge({ variant = 'gray', children, className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${VARIANT_CLASSES[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
