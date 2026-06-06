import { AlertTriangle } from 'lucide-react';
import { Button } from './Button';

interface Props {
  open: boolean;
  titulo: string;
  mensagem: string;
  confirmLabel?: string;
  cancelLabel?: string;
  perigo?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Confirmação elegante para ações destrutivas (substitui window.confirm). */
export function ConfirmDialog({
  open, titulo, mensagem, confirmLabel = 'Confirmar', cancelLabel = 'Cancelar',
  perigo = false, busy = false, onConfirm, onCancel,
}: Props) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={onCancel}>
      <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3">
          <div className={`mt-0.5 rounded-full p-2 ${perigo ? 'bg-red-100 text-red-600' : 'bg-sky-100 text-sky-600'}`}>
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-slate-800">{titulo}</h3>
            <p className="mt-1 text-sm text-slate-600">{mensagem}</p>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={onCancel} disabled={busy}>{cancelLabel}</Button>
          <Button variant={perigo ? 'danger' : 'primary'} onClick={onConfirm} loading={busy}>{confirmLabel}</Button>
        </div>
      </div>
    </div>
  );
}
