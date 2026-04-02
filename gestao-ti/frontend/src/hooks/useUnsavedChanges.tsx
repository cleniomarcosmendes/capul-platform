import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

/**
 * Hook para proteger formularios contra perda de dados nao salvos.
 * Compativel com BrowserRouter (nao requer data router/createBrowserRouter).
 *
 * Protege contra:
 * 1. Fechar browser/aba (beforeunload nativo)
 * 2. Cliques em links internos <a> (intercepta via capture)
 * 3. Botoes Voltar/Cancelar (via guardedNavigate)
 */
export function useUnsavedChanges(isDirty: boolean) {
  const [showDialog, setShowDialog] = useState(false);
  const pendingRef = useRef<(() => void) | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const dirtyRef = useRef(isDirty);
  dirtyRef.current = isDirty;

  // 1. Interceptar fechamento do browser/aba
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  // 2. Interceptar cliques em links <a> internos
  useEffect(() => {
    if (!isDirty) return;
    const handleClick = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest('a[href]') as HTMLAnchorElement | null;
      if (!anchor) return;
      const href = anchor.getAttribute('href');
      if (!href || href.startsWith('http') || href.startsWith('//') || anchor.target === '_blank') return;
      if (href !== location.pathname && dirtyRef.current) {
        e.preventDefault();
        e.stopPropagation();
        pendingRef.current = () => navigate(href);
        setShowDialog(true);
      }
    };
    document.addEventListener('click', handleClick, true);
    return () => document.removeEventListener('click', handleClick, true);
  }, [isDirty, location.pathname, navigate]);

  // 3. guardedNavigate — usar em botoes Voltar/Cancelar no lugar de navigate()
  const guardedNavigate = useCallback((to: string | number) => {
    if (dirtyRef.current) {
      pendingRef.current = () => {
        if (typeof to === 'number') navigate(to);
        else navigate(to);
      };
      setShowDialog(true);
    } else {
      if (typeof to === 'number') navigate(to);
      else navigate(to);
    }
  }, [navigate]);

  const handleStay = useCallback(() => {
    setShowDialog(false);
    pendingRef.current = null;
  }, []);

  const handleLeave = useCallback(() => {
    dirtyRef.current = false;
    setShowDialog(false);
    // Executar no proximo tick para garantir que o state do dialog limpou
    const action = pendingRef.current;
    pendingRef.current = null;
    if (action) {
      setTimeout(action, 0);
    }
  }, []);

  const ConfirmDialog = showDialog ? (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={handleStay} />
      <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md mx-4 relative z-10">
        <h3 className="text-lg font-semibold text-slate-800 mb-2">Alteracoes nao salvas</h3>
        <p className="text-sm text-slate-600 mb-6">
          Voce tem alteracoes que ainda nao foram salvas. Se sair agora, essas alteracoes serao perdidas.
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={handleStay}
            className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
          >
            Continuar editando
          </button>
          <button
            onClick={handleLeave}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
          >
            Sair sem salvar
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return { ConfirmDialog, guardedNavigate };
}
