import { useEffect, useRef, useState } from 'react';
import { CornerDownLeft } from 'lucide-react';
import { projetoService } from '../services/projeto.service';

interface InlineAddTarefaProps {
  projetoId: string;
  /** Fase em que a tarefa será criada (opcional) */
  faseId?: string;
  onCreated: () => void;
  onCancel: () => void;
  /** Troca o inline pelo modal completo (mais campos) */
  onDetalhar: () => void;
}

/**
 * Adição inline estilo Linear: digite o título, Enter cria, Esc cancela.
 * Link "Detalhar com mais campos" abre o NovaTarefaModal.
 */
export function InlineAddTarefa({ projetoId, faseId, onCreated, onCancel, onDetalhar }: InlineAddTarefaProps) {
  const [titulo, setTitulo] = useState('');
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => ref.current?.focus(), 30);
    return () => clearTimeout(t);
  }, []);

  async function criar() {
    const t = titulo.trim();
    if (!t || saving) return;
    setSaving(true);
    try {
      await projetoService.adicionarAtividade(projetoId, { titulo: t, faseId: faseId || undefined });
      setTitulo('');
      onCreated();
      // Mantém aberto pra cadastro em sequência; refoca
      setTimeout(() => ref.current?.focus(), 30);
    } catch { /* erro tratado pelo interceptor */ }
    setSaving(false);
  }

  return (
    <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
      <input
        ref={ref}
        type="text"
        value={titulo}
        onChange={(e) => setTitulo(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); criar(); }
          if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
        }}
        disabled={saving}
        placeholder="Titulo da nova tarefa… (Enter cria, Esc cancela)"
        autoComplete="off"
        className="w-full border border-capul-400 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-capul-500/30 disabled:opacity-60"
      />
      <div className="mt-1.5 flex items-center gap-4 text-[11px] text-slate-400">
        <span className="flex items-center gap-1"><CornerDownLeft className="w-3 h-3" /> Enter cria</span>
        <span>Esc cancela</span>
        <button onClick={onDetalhar} className="text-capul-600 hover:underline">+ Detalhar com mais campos</button>
      </div>
    </div>
  );
}
