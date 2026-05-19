import { useCallback, useState } from 'react';

/**
 * Estado do drawer de tarefa (aba Atividades de Projeto/Subprojeto).
 * `openTarefaId` é a única fonte de verdade — a tarefa selecionada/aberta.
 */
export function useTarefaDrawer() {
  const [openTarefaId, setOpenTarefaId] = useState<string | null>(null);

  const open = useCallback((id: string) => setOpenTarefaId(id), []);
  const close = useCallback(() => setOpenTarefaId(null), []);

  return { openTarefaId, isOpen: openTarefaId != null, open, close };
}
