import type { ReactNode } from 'react';

type Tom = 'neutro' | 'verde' | 'ambar' | 'vermelho' | 'azul';

const TONS: Record<Tom, string> = {
  neutro: 'bg-slate-100 text-slate-700',
  verde: 'bg-capul-100 text-capul-700',
  ambar: 'bg-amber-100 text-amber-900',
  vermelho: 'bg-red-100 text-red-800',
  azul: 'bg-sky-100 text-sky-800',
};

export function Etiqueta({ tom = 'neutro', children }: { tom?: Tom; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${TONS[tom]}`}
    >
      {children}
    </span>
  );
}

/** O status do ciclo com a cor que ele merece — RASCUNHO não é ABERTO. */
export function EtiquetaDeCiclo({ status }: { status: string }) {
  const tom: Tom =
    status === 'ABERTO'
      ? 'verde'
      : status === 'RASCUNHO'
        ? 'neutro'
        : status === 'EM_APURACAO'
          ? 'azul'
          : status === 'CANCELADO'
            ? 'vermelho'
            : 'ambar';
  return <Etiqueta tom={tom}>{status.replace('_', ' ')}</Etiqueta>;
}
