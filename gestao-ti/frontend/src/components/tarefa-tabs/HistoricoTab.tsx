import { History, Plus, RefreshCw, Pencil, Users, FolderKanban, Play, Square, MessageSquare } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { AtividadeHistorico, TipoEventoAtividade } from '../../types';
import { EmptyState } from '../EmptyState';

const iconePorTipo: Record<TipoEventoAtividade, LucideIcon> = {
  CRIADA: Plus,
  STATUS_ALTERADO: RefreshCw,
  TITULO_ALTERADO: Pencil,
  RESPONSAVEL_ALTERADO: Users,
  FASE_ALTERADA: FolderKanban,
  TEMPO_INICIADO: Play,
  TEMPO_ENCERRADO: Square,
  COMENTARIO_ADICIONADO: MessageSquare,
};

function fmtQuando(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
}

interface HistoricoTabProps {
  historico: AtividadeHistorico[];
  loading: boolean;
}

/** Timeline cronológica da tarefa (eventos do drawer). Read-only. */
export function HistoricoTab({ historico, loading }: HistoricoTabProps) {
  if (loading) return <p className="px-5 py-4 text-xs text-slate-400">Carregando...</p>;
  if (historico.length === 0) {
    return <EmptyState icon={History} message="Nenhum evento registrado ainda" />;
  }

  return (
    <div className="px-5 py-4">
      <ul className="space-y-3">
        {historico.map((h) => {
          const Icon = iconePorTipo[h.tipo] || History;
          return (
            <li key={h.id} className="flex gap-3">
              <div className="flex-shrink-0 mt-0.5">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-500">
                  <Icon className="w-3.5 h-3.5" />
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-700">{h.descricao || h.tipo}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {fmtQuando(h.createdAt)}
                  {h.usuario?.nome ? ` · ${h.usuario.nome}` : ''}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
