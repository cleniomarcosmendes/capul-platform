import { AlertCircle, Inbox, RefreshCw } from 'lucide-react';
import type { ReactNode } from 'react';

/**
 * Os três estados que toda tela de dado remoto tem. Ficam num lugar só porque a
 * versão duplicada envelhece diferente — a segunda cópia é sempre a que esquece
 * de tratar o 403.
 */

export function Carregando({ linhas = 3 }: { linhas?: number }) {
  return (
    <div className="space-y-2" aria-busy aria-live="polite">
      <span className="sr-only">Carregando…</span>
      {Array.from({ length: linhas }, (_, i) => (
        <div key={i} className="h-16 animate-pulse rounded-xl bg-slate-100" />
      ))}
    </div>
  );
}

export function Erro({
  mensagem,
  aoTentarDeNovo,
  dica,
}: {
  mensagem: string;
  /** Ausente = não adianta repetir (403, por exemplo). */
  aoTentarDeNovo?: () => void;
  dica?: string;
}) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-4">
      <div className="flex items-start gap-3">
        <AlertCircle size={20} className="mt-0.5 shrink-0 text-red-500" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="font-medium text-red-900">{mensagem}</p>
          {dica && <p className="mt-1 text-sm text-red-800/80">{dica}</p>}
          {aoTentarDeNovo && (
            <button
              type="button"
              onClick={aoTentarDeNovo}
              className="alvo-toque mt-3 inline-flex items-center gap-2 rounded-lg border border-red-300 bg-white px-3 text-sm font-medium text-red-800"
            >
              <RefreshCw size={15} aria-hidden /> Tentar de novo
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function Vazio({ titulo, detalhe, acao }: { titulo: string; detalhe?: string; acao?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center">
      <Inbox size={32} className="mx-auto text-slate-300" aria-hidden />
      <p className="mt-3 font-medium text-slate-700">{titulo}</p>
      {detalhe && <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">{detalhe}</p>}
      {acao && <div className="mt-4">{acao}</div>}
    </div>
  );
}
