import { useEffect, useMemo, useState } from 'react';
import {
  X, Save, Loader2, Check, Sparkles,
  Ticket, FolderKanban, ClipboardList, Users, FileText, Receipt,
  AppWindow, KeyRound, Server, Activity, BarChart3, TrendingUp,
  type LucideIcon,
} from 'lucide-react';
import {
  departamentoFuncionalidadeService,
  TODAS_FUNCIONALIDADES,
  SECOES,
  type FuncionalidadeWorkspace,
  type FuncionalidadeStatus,
  type FuncionalidadeMeta,
} from '../../services/departamento-funcionalidade.service';
import { useToast } from '../../components/Toast';
import { extractApiError } from '../../utils/errors';

interface Props {
  departamentoId: string;
  departamentoNome: string;
  open: boolean;
  onClose: () => void;
}

// Mapping ícone-string → componente lucide (resolve no module scope, sem re-render).
const ICONES: Record<FuncionalidadeMeta['icone'], LucideIcon> = {
  Ticket, FolderKanban, ClipboardList, Users, FileText, Receipt,
  AppWindow, KeyRound, Server, Activity, BarChart3, TrendingUp,
};

/**
 * Drawer lateral pra gerenciar funcionalidades habilitadas de um
 * departamento. Workspace Multi-Departamento (Onda 1 Sub-fase 1.6.2 — D32).
 *
 * UX redesign (25/05): cards-toggle agrupados por seção, ícone + descrição,
 * contador + atalhos "Todas/Nenhuma", drawer mais largo, indicador de
 * alterações pendentes no footer.
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

  function marcarTodas() {
    const map = {} as Record<FuncionalidadeWorkspace, boolean>;
    TODAS_FUNCIONALIDADES.forEach((f) => { map[f.codigo] = true; });
    setFuncs(map);
  }

  function desmarcarTodas() {
    const map = {} as Record<FuncionalidadeWorkspace, boolean>;
    TODAS_FUNCIONALIDADES.forEach((f) => { map[f.codigo] = false; });
    setFuncs(map);
  }

  const { ativas, total, alteracoes } = useMemo(() => {
    let ativasCount = 0;
    let alteracoesCount = 0;
    for (const f of TODAS_FUNCIONALIDADES) {
      if (funcs[f.codigo]) ativasCount++;
      if (funcs[f.codigo] !== original[f.codigo]) alteracoesCount++;
    }
    return { ativas: ativasCount, total: TODAS_FUNCIONALIDADES.length, alteracoes: alteracoesCount };
  }, [funcs, original]);

  const hasChanges = alteracoes > 0;

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
      <div className="w-full max-w-lg bg-white shadow-xl flex flex-col">
        {/* Header */}
        <div className="border-b px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-emerald-600" />
                Funcionalidades do Workspace
              </h2>
              <p className="text-sm text-slate-500 truncate mt-0.5">{departamentoNome}</p>
            </div>
            <button
              onClick={onClose}
              className="rounded p-1 hover:bg-slate-100 text-slate-500 flex-shrink-0"
              aria-label="Fechar"
            >
              <X size={20} />
            </button>
          </div>

          {/* Contador + ações em massa */}
          {!loading && (
            <div className="flex items-center justify-between mt-3 gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <div className="bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1 text-xs font-medium text-emerald-700">
                  {ativas} de {total} ativas
                </div>
                {alteracoes > 0 && (
                  <span className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-1">
                    {alteracoes} pendente{alteracoes === 1 ? '' : 's'}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={marcarTodas}
                  className="text-[11px] px-2.5 py-1 rounded border border-slate-300 text-slate-600 hover:bg-slate-50"
                >
                  Todas
                </button>
                <button
                  type="button"
                  onClick={desmarcarTodas}
                  className="text-[11px] px-2.5 py-1 rounded border border-slate-300 text-slate-600 hover:bg-slate-50"
                >
                  Nenhuma
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Conteúdo */}
        <div className="flex-1 overflow-auto px-5 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-slate-500">
              <Loader2 className="animate-spin mr-2" size={20} />
              Carregando…
            </div>
          ) : (
            <>
              <p className="text-xs text-slate-500 mb-4">
                Marque as funcionalidades que o departamento <strong>{departamentoNome}</strong> pode operar.
                Cada mudança é auditada (quem ativou/desativou). Roles do usuário ainda restringem
                o acesso dentro de cada funcionalidade.
              </p>

              <div className="space-y-5">
                {SECOES.map((secao) => {
                  const itens = TODAS_FUNCIONALIDADES.filter((f) => f.secao === secao.id);
                  if (itens.length === 0) return null;
                  return (
                    <div key={secao.id}>
                      <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                        {secao.rotulo}
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {itens.map((f, idx) => {
                          const ativo = !!funcs[f.codigo];
                          const modificado = funcs[f.codigo] !== original[f.codigo];
                          const Icone = ICONES[f.icone];
                          // Evita "buraco" na grade: último item de seção
                          // com nº ímpar de itens ocupa as 2 colunas.
                          const spanFull = itens.length % 2 === 1 && idx === itens.length - 1;
                          return (
                            <button
                              key={f.codigo}
                              type="button"
                              onClick={() => toggle(f.codigo)}
                              className={`relative group text-left rounded-lg border p-3 transition-all ${
                                spanFull ? 'sm:col-span-2' : ''
                              } ${
                                ativo
                                  ? 'border-emerald-300 bg-emerald-50/60 hover:bg-emerald-50'
                                  : 'border-slate-200 bg-white hover:bg-slate-50'
                              }`}
                            >
                              {modificado && (
                                <span
                                  className="absolute top-2 right-2 w-2 h-2 rounded-full bg-amber-500"
                                  title="Alteração pendente"
                                />
                              )}
                              <div className="flex items-start gap-2.5">
                                <div className={`flex-shrink-0 w-9 h-9 rounded-md flex items-center justify-center ${
                                  ativo ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                                }`}>
                                  <Icone className="w-5 h-5" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5">
                                    <span className={`text-sm font-medium truncate ${
                                      ativo ? 'text-slate-800' : 'text-slate-600'
                                    }`}>
                                      {f.rotulo}
                                    </span>
                                    {ativo && (
                                      <Check className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                                    )}
                                  </div>
                                  <p className="text-[11px] text-slate-500 leading-snug mt-0.5">
                                    {f.descricao}
                                  </p>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="border-t px-5 py-3 flex items-center justify-between gap-3">
          <span className="text-xs text-slate-500">
            {alteracoes > 0
              ? `${alteracoes} alteraç${alteracoes === 1 ? 'ão' : 'ões'} pendente${alteracoes === 1 ? '' : 's'}`
              : 'Nenhuma alteração'}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-300 text-sm text-slate-600 hover:bg-slate-50"
              disabled={saving}
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={!hasChanges || saving || loading}
              className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm flex items-center gap-2 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
              Salvar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
