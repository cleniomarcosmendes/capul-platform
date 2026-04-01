import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

/**
 * Hook para proteger formularios contra perda de dados nao salvos.
 * Compativel com BrowserRouter (nao requer data router/createBrowserRouter).
 *
 * @param isDirty - true quando o formulario tem alteracoes nao salvas
 *
 * Funcionalidades:
 * 1. Intercepta fechamento do browser/aba (beforeunload)
 * 2. Intercepta navegacao interna via botao voltar do browser (popstate)
 * 3. Intercepta cliques em links internos (click capture)
 */
export function useUnsavedChanges(isDirty: boolean) {
  const [showDialog, setShowDialog] = useState(false);
  const [pendingPath, setPendingPath] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const dirtyRef = useRef(isDirty);
  dirtyRef.current = isDirty;

  // 1. Interceptar fechamento do browser/aba
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  // 2. Interceptar botao voltar do browser (popstate)
  useEffect(() => {
    if (!isDirty) return;

    // Push um estado extra para poder interceptar o "voltar"
    window.history.pushState({ unsavedGuard: true }, '');

    const handlePopState = (_e: PopStateEvent) => {
      if (dirtyRef.current) {
        // Re-push para manter na mesma pagina
        window.history.pushState({ unsavedGuard: true }, '');
        setShowDialog(true);
        setPendingPath('__back__');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isDirty]);

  // 3. Interceptar cliques em links internos (captura no document)
  useEffect(() => {
    if (!isDirty) return;

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const anchor = target.closest('a[href]') as HTMLAnchorElement | null;
      if (!anchor) return;

      const href = anchor.getAttribute('href');
      if (!href || href.startsWith('http') || href.startsWith('//') || anchor.target === '_blank') return;

      // Link interno do sistema
      if (href !== location.pathname && dirtyRef.current) {
        e.preventDefault();
        e.stopPropagation();
        setPendingPath(href);
        setShowDialog(true);
      }
    };

    document.addEventListener('click', handleClick, true);
    return () => document.removeEventListener('click', handleClick, true);
  }, [isDirty, location.pathname]);

  const handleStay = useCallback(() => {
    setShowDialog(false);
    setPendingPath(null);
  }, []);

  const handleLeave = useCallback(() => {
    setShowDialog(false);
    const path = pendingPath;
    setPendingPath(null);

    // Desativar dirty temporariamente para permitir navegacao
    dirtyRef.current = false;

    if (path === '__back__') {
      window.history.go(-1);
    } else if (path) {
      navigate(path);
    }
  }, [pendingPath, navigate]);

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

  return { ConfirmDialog };
}
