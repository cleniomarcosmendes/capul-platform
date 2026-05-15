import { type ReactNode } from 'react';
import { X } from 'lucide-react';
import { Drawer } from './Drawer';

interface TarefaDrawerProps {
  open: boolean;
  onClose: () => void;
  titulo: string;
  /** "FASE 2 · Implementação" — opcional (tarefa sem fase) */
  breadcrumb?: string;
  /** Conteúdo do corpo (controles + cronômetro + notas), composto pelo TabCronograma */
  children: ReactNode;
}

/**
 * Drawer da tarefa — chrome (header + área rolável) sobre o <Drawer> genérico.
 * O conteúdo (controles, cronômetro, notas) é passado por composição para
 * reaproveitar exatamente os handlers/JSX já existentes em TabCronograma e
 * evitar regressão (plano PR2: "só muda o container").
 */
export function TarefaDrawer({ open, onClose, titulo, breadcrumb, children }: TarefaDrawerProps) {
  return (
    <Drawer open={open} onClose={onClose} ariaLabel={titulo ? `Tarefa: ${titulo}` : 'Tarefa'}>
      <div className="px-4 py-3 border-b border-slate-200 flex items-start gap-2 flex-shrink-0">
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-700 transition-colors p-1 -ml-1 flex-shrink-0"
          aria-label="Fechar painel"
          title="Fechar (Esc)"
        >
          <X className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          {breadcrumb && (
            <div className="text-[11px] text-slate-400 truncate">{breadcrumb}</div>
          )}
          <h3 className="text-base font-semibold text-slate-800 leading-snug break-words">{titulo}</h3>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {children}
      </div>
    </Drawer>
  );
}
