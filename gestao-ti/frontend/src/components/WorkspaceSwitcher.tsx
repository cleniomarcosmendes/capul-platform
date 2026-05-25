import { useState, useRef, useEffect } from 'react';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { Briefcase, ChevronDown, Check } from 'lucide-react';

/**
 * S15.4 (25/05) — Workspace ATIVO da sessão (estilo Hub).
 *
 * Single-perfil: badge fixa (só informa, sem dropdown).
 * Multi-perfil: dropdown clicável. Ao trocar, dá page reload pra garantir
 * que TODAS as listas recarreguem com o header X-Workspace-Id novo (mais
 * simples que invalidar caches espalhados em useState).
 *
 * Default no primeiro login multi-perfil: null (backend usa fallback
 * S12/S13/S14 — vê união). User deve escolher conscientemente.
 */
export function WorkspaceSwitcher() {
  const { workspaces, workspaceAtivoId, isMultiPerfil, setWorkspaceAtivo } = useWorkspace();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (workspaces.length === 0) return null;

  const ativoLabel = workspaceAtivoId
    ? workspaces.find((w) => w.id === workspaceAtivoId)?.nome
    : 'Todos workspaces';

  function selecionar(id: string | null) {
    setWorkspaceAtivo(id);
    setOpen(false);
    // Page reload — garante que listas/dashboard recarreguem com o header
    // novo. Mais simples e robusto que invalidar caches manuais.
    window.location.reload();
  }

  // Single-perfil: badge fixa só pra contexto visual.
  if (!isMultiPerfil) {
    return (
      <div className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200" title="Você só tem perfil neste workspace">
        <Briefcase className="w-3 h-3" />
        <span className="font-medium truncate max-w-[140px]">{workspaces[0].nome}</span>
      </div>
    );
  }

  // Multi-perfil: dropdown.
  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-capul-50 text-capul-700 border border-capul-200 hover:bg-capul-100 transition-colors"
        title="Trocar de workspace ativo"
      >
        <Briefcase className="w-3 h-3" />
        <span className="font-medium truncate max-w-[140px]">{ativoLabel}</span>
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-slate-200 z-50 overflow-hidden">
          <div className="px-3 py-2 text-[10px] uppercase tracking-wide text-slate-400 font-semibold border-b border-slate-100">
            Workspace ativo
          </div>
          <button
            onClick={() => selecionar(null)}
            className={`w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-slate-50 transition-colors ${workspaceAtivoId === null ? 'bg-slate-50' : ''}`}
          >
            <div>
              <div className="text-slate-700">Todos workspaces</div>
              <div className="text-[10px] text-slate-400">Vê união de todos os perfis</div>
            </div>
            {workspaceAtivoId === null && <Check className="w-4 h-4 text-capul-600" />}
          </button>
          <div className="border-t border-slate-100" />
          {workspaces.map((w) => {
            const ativo = w.id === workspaceAtivoId;
            return (
              <button
                key={w.id}
                onClick={() => selecionar(w.id)}
                className={`w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-slate-50 transition-colors ${ativo ? 'bg-capul-50' : ''}`}
              >
                <div className="flex-1 min-w-0 text-left">
                  <div className={`truncate ${ativo ? 'text-capul-700 font-medium' : 'text-slate-700'}`}>{w.nome}</div>
                  <div className="text-[10px] text-slate-400">{w.role}{w.isTI ? ' · TI' : ''}</div>
                </div>
                {ativo && <Check className="w-4 h-4 text-capul-600" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
