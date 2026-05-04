import { Check, Circle } from 'lucide-react';

export interface EtapaItem {
  key: string;
  label: string;
}

interface EtapaStepperProps {
  steps: EtapaItem[];
  currentStep: string;
  /** Mostra etapas futuras como "neutras" (cinza). Default true. */
  showFutureSteps?: boolean;
}

/**
 * Stepper horizontal de etapas — verde nas concluídas, laranja na atual, cinza nas futuras.
 * Inspirado em fluxos de chamado/processo (Aberto → Em análise → Pendente → Validação → Encerrado).
 */
export function EtapaStepper({ steps, currentStep, showFutureSteps = true }: EtapaStepperProps) {
  const currentIdx = steps.findIndex((s) => s.key === currentStep);
  const idx = currentIdx === -1 ? 0 : currentIdx;

  const visibleSteps = showFutureSteps ? steps : steps.slice(0, idx + 1);

  return (
    <div className="flex items-stretch gap-2 overflow-x-auto py-1">
      {visibleSteps.map((step, i) => {
        const isDone = i < idx;
        const isCurrent = i === idx;
        const isFuture = i > idx;

        const labelColor = isDone ? 'text-emerald-700' : isCurrent ? 'text-amber-700' : 'text-slate-400';
        const barColor = isDone ? 'bg-emerald-500' : isCurrent ? 'bg-amber-500' : 'bg-slate-200';
        const iconBg = isDone ? 'text-emerald-600' : isCurrent ? 'text-amber-600' : 'text-slate-300';

        return (
          <div key={step.key} className="flex-1 min-w-[110px] flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5">
              {isDone ? (
                <Check className={`w-3.5 h-3.5 ${iconBg}`} />
              ) : (
                <Circle className={`w-3.5 h-3.5 ${iconBg}`} />
              )}
              <span className={`text-xs font-medium whitespace-nowrap ${labelColor} ${isFuture ? '' : ''}`}>
                {step.label}
              </span>
            </div>
            <div className={`h-1.5 rounded-full ${barColor} ${isCurrent ? 'animate-pulse' : ''}`} />
          </div>
        );
      })}
    </div>
  );
}

// === Definição das etapas pré-prontas ===

export const ETAPAS_INVENTARIO: EtapaItem[] = [
  { key: 'EM_PREPARACAO', label: 'Em Preparação' },
  { key: 'EM_CONTAGEM',   label: 'Em Contagem' },
  { key: 'ENCERRADO',     label: 'Encerrado' },
  { key: 'ANALISADO',     label: 'Analisado' },
  { key: 'INTEGRADO',     label: 'Integrado' },
];

export const ETAPAS_LISTA: EtapaItem[] = [
  { key: 'PREPARACAO',  label: 'Preparação' },
  { key: 'ABERTA',      label: 'Aberta' },
  { key: 'EM_CONTAGEM', label: 'Em Contagem' },
  { key: 'ENCERRADA',   label: 'Encerrada' },
];
