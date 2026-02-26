import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({ message = 'Erro ao carregar dados.', onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <AlertTriangle className="w-12 h-12 text-red-300 mb-3" />
      <p className="text-sm text-red-600 font-medium mb-1">{message}</p>
      <p className="text-xs text-slate-500 mb-4">Verifique sua conexao e tente novamente.</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="flex items-center gap-2 px-4 py-2 text-sm bg-white border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-700"
        >
          <RotateCcw className="w-4 h-4" />
          Tentar novamente
        </button>
      )}
    </div>
  );
}
