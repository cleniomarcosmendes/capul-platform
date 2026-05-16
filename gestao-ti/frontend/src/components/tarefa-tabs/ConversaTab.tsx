import { useState } from 'react';
import { MessageSquare, Pencil, Trash2, ArrowUpDown } from 'lucide-react';
import type { ComentarioTarefa } from '../../types';
import { MentionInput } from '../MentionInput';
import { EmptyState } from '../EmptyState';

const MAX_LEN = 5000;

/** Contador de caracteres discreto — só aparece perto do limite (igual chamado/pendência). */
function CharCount({ value }: { value: string }) {
  const n = value.length;
  if (n < 4000) return null;
  const cor = n >= 4900 ? 'text-red-500' : n >= 4500 ? 'text-amber-500' : 'text-slate-400';
  return <span className={`text-[10px] tabular-nums ${cor}`}>{n}/{MAX_LEN}</span>;
}

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
 * Aba "Conversa" — chat-style: minhas mensagens à direita (verde), as dos
 * outros à esquerda (cinza). Por padrão lista as mais RECENTES primeiro
 * (toggle alterna p/ antigas primeiro). Composer fixo no rodapé, cresce
 * conforme digita (autoGrow). Estado de edição é local.
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
  // Padrão: recentes primeiro (mais novas no topo). Toggle alterna p/ antigas primeiro.
  const [ordemAsc, setOrdemAsc] = useState(false);

  const ordenados = [...comentarios].sort((a, b) => {
    const d = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    return ordemAsc ? d : -d;
  });

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
      {/* Barra: contagem + ordenação */}
      {!loading && ordenados.length > 0 && (
        <div className="flex items-center justify-between px-5 py-2 border-b border-slate-100 flex-shrink-0">
          <span className="text-[11px] text-slate-400">{ordenados.length} nota(s)</span>
          <button
            onClick={() => setOrdemAsc((v) => !v)}
            className="text-[11px] text-slate-500 hover:text-capul-600 inline-flex items-center gap-1"
            title="Alternar ordem"
          >
            <ArrowUpDown className="w-3 h-3" />
            {ordemAsc ? 'Antigas primeiro' : 'Recentes primeiro'}
          </button>
        </div>
      )}

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
                      autoGrow
                      minRows={3}
                      maxRows={10}
                      maxLength={MAX_LEN}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs"
                      placeholder="Editar nota... (use @usuario para mencionar)"
                    />
                    <div className="flex items-center justify-between mt-1 mb-2">
                      {pendenciaNumero != null ? (
                        <label className="flex items-center gap-2 text-xs text-slate-500 cursor-pointer">
                          <input type="checkbox" checked={editVisivel} onChange={(e) => setEditVisivel(e.target.checked)} className="rounded border-slate-300" />
                          Visivel na Pendencia #{pendenciaNumero}
                        </label>
                      ) : <span />}
                      <CharCount value={editTexto} />
                    </div>
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

      {/* Composer fixo no rodapé — textarea cresce conforme digita (até 10 linhas) */}
      <div className="border-t border-slate-200 bg-white px-4 py-3 flex-shrink-0">
        <div className="border border-slate-300 rounded-lg focus-within:border-capul-500 focus-within:ring-2 focus-within:ring-capul-500/20 transition-colors">
          <MentionInput
            value={novo}
            onChange={setNovo}
            usuarios={mentionUsers}
            placeholder="Escreva uma nota... (use @usuario para mencionar)"
            autoGrow
            minRows={3}
            maxRows={10}
            maxLength={MAX_LEN}
            className="w-full border-0 bg-transparent px-3 py-2 text-xs focus:outline-none focus:ring-0 resize-none"
          />
        </div>
        <div className="mt-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            {pendenciaNumero != null && (
              <label className="flex items-center gap-2 text-[11px] text-slate-500 cursor-pointer">
                <input type="checkbox" checked={novoVisivel} onChange={(e) => setNovoVisivel(e.target.checked)} className="rounded border-slate-300" />
                Visivel na Pendencia #{pendenciaNumero}
              </label>
            )}
            <CharCount value={novo} />
          </div>
          <button onClick={enviar} disabled={!novo.trim() || enviando} className="bg-capul-600 text-white px-4 py-1.5 rounded-lg text-xs hover:bg-capul-700 disabled:opacity-50">
            {enviando ? '...' : 'Enviar'}
          </button>
        </div>
      </div>
    </div>
  );
}
