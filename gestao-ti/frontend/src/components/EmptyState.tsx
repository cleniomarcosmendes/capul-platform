import { type LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  message: string;
  /** CTA opcional (texto + ação) */
  ctaLabel?: string;
  onCta?: () => void;
}

/** Estado vazio reutilizável (ícone esmaecido + mensagem + CTA opcional). */
export function EmptyState({ icon: Icon, message, ctaLabel, onCta }: EmptyStateProps) {
  return (
    <div className="text-center px-4 py-10 text-slate-400">
      <Icon className="w-9 h-9 mx-auto mb-2.5 opacity-35" />
      <p className="text-xs">{message}</p>
      {ctaLabel && onCta && (
        <button
          onClick={onCta}
          className="mt-3 text-xs text-capul-600 hover:underline font-medium"
        >
          {ctaLabel}
        </button>
      )}
    </div>
  );
}
