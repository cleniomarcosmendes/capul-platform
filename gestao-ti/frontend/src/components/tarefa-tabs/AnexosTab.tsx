import { Paperclip } from 'lucide-react';
import { EmptyState } from '../EmptyState';

/**
 * Aba "Anexos" do drawer.
 *
 * Tarefas de projeto ainda não têm anexos próprios no backend (AtividadeProjeto
 * não tem relação de anexos — diferente de Chamado/Pendência). Mantemos a aba
 * como placeholder honesto, alinhado ao mockup V3 (que também só mostra empty
 * state aqui). Quando/se anexo de tarefa entrar no backend, esta aba ganha a
 * lista + uploader sem mexer no resto do drawer.
 */
export function AnexosTab() {
  return <EmptyState icon={Paperclip} message="Anexos de tarefa ainda não disponíveis" />;
}
