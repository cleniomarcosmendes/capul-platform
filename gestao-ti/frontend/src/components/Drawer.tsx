import { useEffect, useState, type ReactNode } from 'react';

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  ariaLabel?: string;
}

/**
 * Drawer lateral responsivo, reutilizável.
 *
 * - `< 768px`  → full-screen
 * - `768-1439` → overlay (flutua com backdrop escuro)
 * - `≥ 1440px` → push (sem backdrop; o container da lista reserva o espaço
 *                aplicando `min-[1440px]:pr-[420px]` quando aberto)
 *
 * O reflow "push" é responsabilidade do consumidor (padding na área da lista),
 * já que o painel é `position: fixed` à direita da viewport.
 */
export function Drawer({ open, onClose, children, ariaLabel }: DrawerProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => setMounted(true));
    return () => { cancelAnimationFrame(id); setMounted(false); };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop — só em overlay/mobile; oculto no modo push (≥1440px) */}
      <div
        className={`fixed inset-0 z-40 bg-slate-900/40 transition-opacity duration-200 min-[1440px]:hidden ${mounted ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        className={`fixed top-0 right-0 bottom-0 z-50 bg-white shadow-2xl flex flex-col w-full md:w-[var(--tarefa-drawer-w)] md:max-w-[92vw] border-l border-slate-200 transition-transform duration-200 ${mounted ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {children}
      </aside>
    </>
  );
}
