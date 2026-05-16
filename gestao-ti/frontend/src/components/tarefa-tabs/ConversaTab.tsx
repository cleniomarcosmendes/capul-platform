import { useState } from 'react';
import { MessageSquare, Pencil, Trash2 } from 'lucide-react';
import type { ComentarioTarefa } from '../../types';
import { MentionInput } from '../MentionInput';
import { EmptyState } from '../EmptyState';

interface Membro { id: string; nome: string; username: string }

interface ConversaTabProps {
  comentarios: ComentarioTarefa[];
  loading: boolean;
  currentUserId: string;
  canManage: boolean;
  membros: Membro[];
  pendenciaNumero?: number;
  onEnviar: (texto: string, visivelPendencia: boolean) => Promise<void>;
  onEditar: (id: string, texto: string, visivelPendencia: boolean) => Promise<void>;
  onRemover: (id: string) => Promise<void>;
}

function fmtQuando(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
}

/**
 * Aba "Conversa" — chat-style (espelha o layout de chamado/pendência):
 * minhas mensagens à direita (verde), as dos outros à esquerda (cinza),
 * mais recente embaixo, composer fixo no rodapé. Estado de edição é local.
 */
export function ConversaTab({
  comentarios, loading, currentUserId, canManage, membros, pendenciaNumero,
  onEnviar, onEditar, onRemover,
}: ConversaTabProps) {
  const [novo, setNovo] = useState('');
  const [novoVisivel, setNovoVisivel] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editTexto, setEditTexto] = useState('');
  const [editVisivel, setEditVisivel] = useState(false);
  const [salvandoEdit, setSalvandoEdit] = useState(false);

  // ordem cronológica ASC (mais recente embaixo, estilo chat)
  const ordenados = [...comentarios].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );

  async function enviar() {
    if (!novo.trim() || enviando) return;
    setEnviando(true);
    try {
      await onEnviar(novo.trim(), novoVisivel);
      setNovo('');
      setNovoVisivel(false);
    } finally {
      setEnviando(false);
    }
  }

  function startEdit(c: ComentarioTarefa) {
    setEditId(c.id);
    setEditTexto(c.texto);
    setEditVisivel(c.visivelPendencia ?? false);
  }

  async function salvarEdit() {
    if (!editId || !editTexto.trim() || salvandoEdit) return;
    setSalvandoEdit(true);
    try {
      await onEditar(editId, editTexto.trim(), editVisivel);
      setEditId(null);
      setEditTexto('');
    } finally {
      setSalvandoEdit(false);
    }
  }

  const mentionUsers = membros.map((m) => ({ id: m.id, nome: m.nome, username: m.username }));

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {loading ? (
          <p className="text-xs text-slate-400">Carregando...</p>
        ) : ordenados.length === 0 ? (
          <EmptyState icon={MessageSquare} message="Nenhuma nota ainda. Seja o primeiro a comentar." />
        ) : (
          <div className="space-y-3">
            {ordenados.map((c) => {
              const meu = c.usuarioId === currentUserId;
              const editando = editId === c.id;
              if (editando) {
                return (
                  <div key={c.id} className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-3">
                    <MentionInput
                      value={editTexto}
                      onChange={setEditTexto}
                      usuarios={mentionUsers}
                      rows={4}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs mb-2"
                      placeholder="Editar nota... (use @usuario para mencionar)"
                    />
                    {pendenciaNumero != null && (
                      <label className="flex items-center gap-2 text-xs text-slate-500 mb-2 cursor-pointer">
                        <input type="checkbox" checked={editVisivel} onChange={(e) => setEditVisivel(e.target.checked)} className="rounded border-slate-300" />
                        Visivel na Pendencia #{pendenciaNumero}
                      </label>
                    )}
                    <div className="flex justify-end gap-3">
                      <button onClick={() => { setEditId(null); setEditTexto(''); }} className="text-xs text-slate-500 hover:text-slate-700 px-3 py-1.5">Cancelar</button>
                      <button onClick={salvarEdit} disabled={!editTexto.trim() || salvandoEdit} className="bg-capul-600 text-white px-4 py-1.5 rounded-lg text-xs hover:bg-capul-700 disabled:opacity-50">
                        {salvandoEdit ? '...' : 'Salvar'}
                      </button>
                    </div>
                  </div>
                );
              }
              return (
                <div key={c.id} className={`flex ${meu ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-lg px-3 py-2 ${meu ? 'bg-capul-50 border border-capul-100' : 'bg-slate-100 border border-slate-200'}`}>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[11px] font-medium text-slate-700">{c.usuario.nome}</span>
                      <span className="text-[10px] text-slate-400">{fmtQuando(c.createdAt)}</span>
                      {(canManage || meu) && (
                        <span className="flex items-center gap-1 ml-1">
                          <button onClick={() => startEdit(c)} className="text-slate-300 hover:text-capul-600" title="Editar"><Pencil className="w-3 h-3" /></button>
                          <button onClick={() => onRemover(c.id)} className="text-slate-300 hover:text-red-500" title="Remover"><Trash2 className="w-3 h-3" /></button>
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-700 whitespace-pre-wrap break-words">{c.texto}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Composer fixo no rodapé */}
      <div className="border-t border-slate-200 bg-white px-4 py-3">
        <MentionInput
          value={novo}
          onChange={setNovo}
          usuarios={mentionUsers}
          placeholder="Escreva uma nota... (use @usuario para mencionar)"
          rows={2}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs"
        />
        <div className="mt-2 flex items-center justify-between gap-2">
          {pendenciaNumero != null ? (
            <label className="flex items-center gap-2 text-[11px] text-slate-500 cursor-pointer">
              <input type="checkbox" checked={novoVisivel} onChange={(e) => setNovoVisivel(e.target.checked)} className="rounded border-slate-300" />
              Visivel na Pendencia #{pendenciaNumero}
            </label>
          ) : <span />}
          <button onClick={enviar} disabled={!novo.trim() || enviando} className="bg-capul-600 text-white px-4 py-1.5 rounded-lg text-xs hover:bg-capul-700 disabled:opacity-50">
            {enviando ? '...' : 'Enviar'}
          </button>
        </div>
      </div>
    </div>
  );
}
