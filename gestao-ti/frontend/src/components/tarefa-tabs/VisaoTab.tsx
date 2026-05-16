import type { AtividadeProjeto } from '../../types';
import { formatDateBR } from '../../utils/date';

interface VisaoTabProps {
  atividade: AtividadeProjeto;
  faseNome?: string;
}

function Item({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="text-xs">
      <div className="text-[11px] text-slate-400">{label}</div>
      <div className="text-slate-700 mt-0.5">{children}</div>
    </div>
  );
}

/** Aba "Visão geral" do drawer: descrição + metadados da tarefa. */
export function VisaoTab({ atividade: a, faseNome }: VisaoTabProps) {
  const responsaveis = a.responsaveis && a.responsaveis.length > 0
    ? a.responsaveis.map((r) => r.usuario.nome).join(', ')
    : a.usuario.nome;

  return (
    <div className="px-5 py-4 space-y-5">
      <div>
        <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Descricao</div>
        {a.descricao ? (
          <p className="text-sm text-slate-600 leading-relaxed" style={{ textAlign: 'justify', whiteSpace: 'pre-wrap' }}>{a.descricao}</p>
        ) : (
          <p className="text-xs text-slate-400 italic">Sem descricao</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-4">
        <Item label="Responsavel">{responsaveis}</Item>
        <Item label="Fase">{faseNome || 'Sem fase'}</Item>
        <Item label="Inicio">{a.dataInicio ? formatDateBR(a.dataInicio) : '—'}</Item>
        <Item label="Fim previsto">{a.dataFimPrevista ? formatDateBR(a.dataFimPrevista) : '—'}</Item>
        <Item label="Cronometro">{a._count?.registrosTempo ?? 0} registro(s)</Item>
        <Item label="Conversa">{a._count?.comentarios ?? 0} nota(s)</Item>
        {a.pendencia && <Item label="Pendencia">#{a.pendencia.numero}</Item>}
      </div>
    </div>
  );
}
