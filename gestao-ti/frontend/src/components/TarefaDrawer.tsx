import { type ReactNode } from 'react';
import { X } from 'lucide-react';
import { Drawer } from './Drawer';

export interface DrawerTab {
  key: string;
  label: string;
  count?: number;
}

interface TarefaDrawerProps {
  open: boolean;
  onClose: () => void;
  titulo: string;
  /** "FASE 2 · Implementação" — opcional (tarefa sem fase) */
  breadcrumb?: string;
  /** Controles da tarefa (status / cronômetro / editar / remover) */
  controls?: ReactNode;
  /** Abas internas. Se vazio (ou hideTabs), só renderiza children (ex.: form de edição). */
  tabs?: DrawerTab[];
  activeTab?: string;
  onTabChange?: (key: string) => void;
  hideChrome?: boolean;
  /** Conteúdo da aba ativa, composto pelo TabCronograma. */
  children: ReactNode;
}

/**
 * Drawer da tarefa — header + controles + abas internas (Visão / Cronômetro /
 * Conversa / Anexos / Histórico). Cada aba decide seu próprio scroll: a área
 * de conteúdo é `flex-1 min-h-0 flex flex-col`, então ConversaTab consegue
 * fixar o composer no rodapé enquanto as mensagens rolam.
 */
export function TarefaDrawer({
  open, onClose, titulo, breadcrumb, controls, tabs, activeTab, onTabChange, hideChrome, children,
}: TarefaDrawerProps) {
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
          {breadcrumb && <div className="text-[11px] text-slate-400 truncate">{breadcrumb}</div>}
          <h3 className="text-base font-semibold text-slate-800 leading-snug break-words">{titulo}</h3>
        </div>
      </div>

      {!hideChrome && controls && (
        <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center gap-1.5 flex-shrink-0">
          {controls}
        </div>
      )}

      {!hideChrome && tabs && tabs.length > 0 && (
        <div className="px-4 border-b border-slate-200 flex gap-1 overflow-x-auto flex-shrink-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => onTabChange?.(t.key)}
              className={`py-2.5 px-3 text-xs whitespace-nowrap border-b-2 transition-colors ${
                activeTab === t.key
                  ? 'border-capul-600 text-capul-700 font-medium'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {t.label}
              {t.count != null && <span className="ml-1 text-[10px] text-slate-400">({t.count})</span>}
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 min-h-0 flex flex-col">
        {children}
      </div>
    </Drawer>
  );
}
