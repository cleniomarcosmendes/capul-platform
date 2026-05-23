import { useEffect, useState } from 'react';
import { X, Save, Loader2 } from 'lucide-react';
import {
  departamentoFuncionalidadeService,
  TODAS_FUNCIONALIDADES,
  type FuncionalidadeWorkspace,
  type FuncionalidadeStatus,
} from '../../services/departamento-funcionalidade.service';
import { useToast } from '../../components/Toast';
import { extractApiError } from '../../utils/errors';

interface Props {
  departamentoId: string;
  departamentoNome: string;
  open: boolean;
  onClose: () => void;
}

/**
 * Drawer lateral pra gerenciar funcionalidades habilitadas de um
 * departamento. Workspace Multi-Departamento (Onda 1 Sub-fase 1.6.2 — D32).
 *
 * UX:
 * - Carrega estado atual ao abrir
 * - Grid de 12 checkboxes
 * - Botão "Salvar" envia PATCH bulk
 * - Toast de sucesso/erro
 */
export function DepartamentoFuncionalidadesDrawer({
  departamentoId,
  departamentoNome,
  open,
  onClose,
}: Props) {
  const toast = useToast();
  const [funcs, setFuncs] = useState<Record<FuncionalidadeWorkspace, boolean>>(
    {} as Record<FuncionalidadeWorkspace, boolean>,
  );
  const [original, setOriginal] = useState<Record<FuncionalidadeWorkspace, boolean>>(
    {} as Record<FuncionalidadeWorkspace, boolean>,
  );
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !departamentoId) return;
    setLoading(true);
    departamentoFuncionalidadeService
      .listar(departamentoId)
      .then((list: FuncionalidadeStatus[]) => {
        const map = {} as Record<FuncionalidadeWorkspace, boolean>;
        list.forEach((f) => {
          map[f.funcionalidade] = f.ativo;
        });
        setFuncs(map);
        setOriginal(map);
      })
      .catch((err) => toast.error(extractApiError(err)))
      .finally(() => setLoading(false));
  }, [open, departamentoId, toast]);

  function toggle(codigo: FuncionalidadeWorkspace) {
    setFuncs((prev) => ({ ...prev, [codigo]: !prev[codigo] }));
  }

  const hasChanges = TODAS_FUNCIONALIDADES.some(
    (f) => funcs[f.codigo] !== original[f.codigo],
  );

  async function handleSave() {
    setSaving(true);
    try {
      const payload = TODAS_FUNCIONALIDADES.map((f) => ({
        funcionalidade: f.codigo,
        ativo: !!funcs[f.codigo],
      }));
      await departamentoFuncionalidadeService.atualizar(departamentoId, payload);
      toast.success('Funcionalidades atualizadas.');
      setOriginal(funcs);
      onClose();
    } catch (err) {
      toast.error(extractApiError(err));
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      <div
        className="flex-1 bg-black/40"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="w-full max-w-md bg-white shadow-xl flex flex-col">
        <div className="flex items-center justify-between border-b p-4">
          <div>
            <h2 className="text-lg font-semibold">Funcionalidades</h2>
            <p className="text-sm text-gray-500">{departamentoNome}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 hover:bg-gray-100"
            aria-label="Fechar"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-gray-500">
              <Loader2 className="animate-spin mr-2" size={20} />
              Carregando...
            </div>
          ) : (
            <>
              <p className="text-xs text-gray-500 mb-4">
                Marque as funcionalidades que o departamento <strong>{departamentoNome}</strong> pode operar no Workspace. Mudanças são auditadas (quem ativou/desativou).
              </p>
              <div className="space-y-2">
                {TODAS_FUNCIONALIDADES.map((f) => (
                  <label
                    key={f.codigo}
                    className="flex items-center gap-3 rounded border p-2 hover:bg-gray-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={!!funcs[f.codigo]}
                      onChange={() => toggle(f.codigo)}
                      className="w-4 h-4"
                    />
                    <div className="flex-1">
                      <div className="text-sm font-medium">{f.rotulo}</div>
                      <div className="text-xs text-gray-400">{f.codigo}</div>
                    </div>
                  </label>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t p-4">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded border text-sm hover:bg-gray-50"
            disabled={saving}
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={!hasChanges || saving || loading}
            className="px-4 py-2 rounded bg-capul-600 text-white text-sm flex items-center gap-2 disabled:opacity-50"
          >
            {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}
