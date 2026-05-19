import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { projetoService } from '../services/projeto.service';
import { MultiSelectDropdown } from './MultiSelectDropdown';
import type { FaseProjeto, MembroProjeto } from '../types';

interface NovaTarefaModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  projetoId: string;
  fases: FaseProjeto[];
  membrosEquipe: MembroProjeto[];
  /** Fase pré-selecionada (ao criar a partir de uma fase específica) */
  faseIdPadrao?: string;
}

/**
 * Modal de criação de tarefa — substitui o formulário persistente que ficava
 * no topo da aba Atividades. Segue o padrão de modais da plataforma
 * (backdrop fixed + card branco), com bottom-sheet em telas < 768px.
 */
export function NovaTarefaModal({ open, onClose, onCreated, projetoId, fases, membrosEquipe, faseIdPadrao }: NovaTarefaModalProps) {
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [faseId, setFaseId] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFimPrevista, setDataFimPrevista] = useState('');
  const [responsavelIds, setResponsavelIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [mounted, setMounted] = useState(false);
  const tituloRef = useRef<HTMLInputElement>(null);

  // Reset + autofocus ao abrir
  useEffect(() => {
    if (open) {
      setTitulo('');
      setDescricao('');
      setFaseId(faseIdPadrao || '');
      setDataInicio('');
      setDataFimPrevista('');
      setResponsavelIds([]);
      setSaving(false);
      const t1 = setTimeout(() => setMounted(true), 10);
      const t2 = setTimeout(() => tituloRef.current?.focus(), 60);
      return () => { clearTimeout(t1); clearTimeout(t2); };
    }
    setMounted(false);
  }, [open, faseIdPadrao]);

  async function handleSubmit() {
    if (!titulo.trim() || saving) return;
    setSaving(true);
    try {
      await projetoService.adicionarAtividade(projetoId, {
        titulo: titulo.trim(),
        descricao: descricao.trim() || undefined,
        faseId: faseId || undefined,
        responsavelIds: responsavelIds.length > 0 ? responsavelIds : undefined,
        dataInicio: dataInicio ? new Date(dataInicio).toISOString() : undefined,
        dataFimPrevista: dataFimPrevista ? new Date(dataFimPrevista).toISOString() : undefined,
      });
      onCreated();
      onClose();
    } catch { /* erro tratado pelo interceptor */ }
    setSaving(false);
  }

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); handleSubmit(); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, titulo, descricao, faseId, dataInicio, dataFimPrevista, responsavelIds, saving]);

  if (!open) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 transition-opacity duration-200 ${mounted ? 'opacity-100' : 'opacity-0'}`}
      onClick={onClose}
    >
      <div
        className={`bg-white w-full max-w-lg shadow-2xl flex flex-col max-h-[92dvh] rounded-t-2xl md:rounded-xl md:mx-4 transition-transform duration-200 ${mounted ? 'translate-y-0' : 'translate-y-4 md:translate-y-0 md:scale-95'}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-800">Nova tarefa</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors p-1" aria-label="Fechar">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 overflow-y-auto space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Titulo *</label>
            <input
              ref={tituloRef}
              type="text"
              placeholder="O que precisa ser feito?"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-capul-500/30 focus:border-capul-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Data Inicio</label>
              <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Data Fim Prevista</label>
              <input type="date" value={dataFimPrevista} min={dataInicio || undefined} onChange={(e) => setDataFimPrevista(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>

          {fases.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Fase</label>
              <select value={faseId} onChange={(e) => setFaseId(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white">
                <option value="">Sem fase</option>
                {fases.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
              </select>
            </div>
          )}

          {membrosEquipe.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Responsaveis</label>
              <MultiSelectDropdown
                options={membrosEquipe.map((m) => ({ value: m.usuarioId, label: m.usuario.nome }))}
                selected={responsavelIds}
                onChange={setResponsavelIds}
                placeholder="Responsaveis (eu, se vazio)"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Descricao (opcional)</label>
            <textarea
              placeholder="Detalhe o que precisa ser feito, parametros, configuracoes..."
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={4}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm resize-y"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-3 rounded-b-none md:rounded-b-xl">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">Cancelar</button>
          <button
            onClick={handleSubmit}
            disabled={!titulo.trim() || saving}
            className="px-5 py-2 text-sm font-medium text-white bg-capul-600 hover:bg-capul-700 disabled:opacity-50 rounded-lg transition-colors"
          >
            {saving ? 'Adicionando...' : 'Adicionar tarefa'}
          </button>
        </div>
      </div>
    </div>
  );
}
