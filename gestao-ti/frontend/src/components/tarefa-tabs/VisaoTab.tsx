import { useState } from 'react';
import { Check, X, Pencil } from 'lucide-react';
import type { AtividadeProjeto } from '../../types';
import { formatDateBR } from '../../utils/date';

type CampoEditavel = 'descricao' | 'dataInicio' | 'dataFimPrevista';

interface VisaoTabProps {
  atividade: AtividadeProjeto;
  faseNome?: string;
  canManage?: boolean;
  /** Salva 1 campo por vez. '' limpa o campo; campo ausente = não mexe. */
  onSave?: (payload: { descricao?: string; dataInicio?: string; dataFimPrevista?: string }) => Promise<void>;
}

function Item({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="text-xs">
      <div className="text-[11px] text-slate-400">{label}</div>
      <div className="text-slate-700 mt-0.5">{children}</div>
    </div>
  );
}

const dateInput = (iso?: string | null) => (iso ? iso.substring(0, 10) : '');

/**
 * Aba "Visão geral" do drawer: descrição + metadados. Descrição, Início e Fim
 * previsto são edição inline (clica no valor/"—", edita, salva) p/ staff que
 * pode gerir — reduz cliques (não precisa abrir o modal de editar tarefa).
 */
export function VisaoTab({ atividade: a, faseNome, canManage, onSave }: VisaoTabProps) {
  const responsaveis = a.responsaveis && a.responsaveis.length > 0
    ? a.responsaveis.map((r) => r.usuario.nome).join(', ')
    : a.usuario.nome;

  const editavel = Boolean(canManage && onSave);
  const [editing, setEditing] = useState<CampoEditavel | null>(null);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  function start(campo: CampoEditavel, valor: string) {
    if (!editavel) return;
    setEditing(campo);
    setDraft(valor);
  }
  function cancel() {
    setEditing(null);
    setDraft('');
  }
  async function commit(campo: CampoEditavel) {
    if (!onSave || saving) return;
    setSaving(true);
    try {
      await onSave({ [campo]: draft });
      setEditing(null);
      setDraft('');
    } finally {
      setSaving(false);
    }
  }

  /** Linha de data editável (Início / Fim previsto). */
  function DataField({ campo, iso }: { campo: 'dataInicio' | 'dataFimPrevista'; iso?: string | null }) {
    if (editing === campo) {
      return (
        <span className="inline-flex items-center gap-1">
          <input
            type="date"
            autoFocus
            value={draft}
            min={campo === 'dataFimPrevista' ? dateInput(a.dataInicio) : undefined}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') commit(campo); if (e.key === 'Escape') cancel(); }}
            className="border border-slate-300 rounded px-1.5 py-0.5 text-xs"
          />
          <button onClick={() => commit(campo)} disabled={saving} className="text-green-600 hover:text-green-700 disabled:opacity-50" title="Salvar"><Check className="w-3.5 h-3.5" /></button>
          <button onClick={cancel} className="text-slate-400 hover:text-slate-600" title="Cancelar"><X className="w-3.5 h-3.5" /></button>
        </span>
      );
    }
    return (
      <button
        type="button"
        onClick={() => start(campo, dateInput(iso))}
        disabled={!editavel}
        className={`group/cell inline-flex items-center gap-1 ${editavel ? 'cursor-pointer hover:text-capul-600' : 'cursor-default'}`}
        title={editavel ? 'Clique para editar' : undefined}
      >
        {iso ? formatDateBR(iso) : <span className="text-slate-400">—</span>}
        {editavel && <Pencil className="w-3 h-3 text-slate-300 opacity-0 group-hover/cell:opacity-100 transition-opacity" />}
      </button>
    );
  }

  return (
    <div className="px-5 py-4 space-y-5">
      <div>
        <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Descricao</div>
        {editing === 'descricao' ? (
          <div>
            <textarea
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') cancel();
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) commit('descricao');
              }}
              rows={4}
              maxLength={5000}
              placeholder="Descreva a tarefa... (Ctrl+Enter salva, Esc cancela)"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-capul-500/20 focus:border-capul-500"
            />
            <div className="flex justify-end gap-2 mt-1.5">
              <button onClick={cancel} className="text-xs text-slate-500 hover:text-slate-700 px-3 py-1">Cancelar</button>
              <button onClick={() => commit('descricao')} disabled={saving} className="inline-flex items-center gap-1 bg-capul-600 text-white px-3 py-1 rounded-lg text-xs hover:bg-capul-700 disabled:opacity-50">
                <Check className="w-3.5 h-3.5" />{saving ? '...' : 'Salvar'}
              </button>
            </div>
          </div>
        ) : (
          <div
            className={`group/desc relative rounded-lg ${editavel ? 'cursor-text hover:bg-slate-50 -mx-2 px-2 py-1' : ''}`}
            onClick={() => editavel && start('descricao', a.descricao || '')}
            title={editavel ? 'Clique para editar' : undefined}
          >
            {a.descricao ? (
              <p className="text-sm text-slate-600 leading-relaxed" style={{ textAlign: 'justify', whiteSpace: 'pre-wrap' }}>{a.descricao}</p>
            ) : (
              <p className="text-xs text-slate-400 italic">{editavel ? 'Sem descricao — clique para adicionar' : 'Sem descricao'}</p>
            )}
            {editavel && (
              <Pencil className="w-3 h-3 text-slate-300 absolute top-1 right-1 opacity-0 group-hover/desc:opacity-100 transition-opacity" />
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-4">
        <Item label="Responsavel">{responsaveis}</Item>
        <Item label="Fase">{faseNome || 'Sem fase'}</Item>
        <Item label="Inicio"><DataField campo="dataInicio" iso={a.dataInicio} /></Item>
        <Item label="Fim previsto"><DataField campo="dataFimPrevista" iso={a.dataFimPrevista} /></Item>
        <Item label="Cronometro">{a._count?.registrosTempo ?? 0} registro(s)</Item>
        <Item label="Conversa">{a._count?.comentarios ?? 0} nota(s)</Item>
        {a.pendencia && <Item label="Pendencia">#{a.pendencia.numero}</Item>}
      </div>
    </div>
  );
}
