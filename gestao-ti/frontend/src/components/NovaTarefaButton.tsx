import { Plus } from 'lucide-react';

interface NovaTarefaButtonProps {
  onClick: () => void;
  /** Mostra a dica de atalho de teclado (N) */
  showKbd?: boolean;
}

/**
 * Botão de ação "Nova tarefa" — substitui o formulário persistente do topo
 * da aba Atividades. Abre o NovaTarefaModal.
 */
export function NovaTarefaButton({ onClick, showKbd = true }: NovaTarefaButtonProps) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-2 bg-capul-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-capul-700 transition-colors shadow-sm"
    >
      <Plus className="w-4 h-4" />
      Nova tarefa
      {showKbd && (
        <span className="ml-1 hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono bg-white/20 rounded border border-white/25">
          N
        </span>
      )}
    </button>
  );
}
