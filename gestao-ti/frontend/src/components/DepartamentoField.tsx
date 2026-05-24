import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { coreService } from '../services/core.service';
import { isWorkspaceModulo } from '../lib/workspace-modulo';
import type { Departamento } from '../types';

/**
 * Workspace Onda 3 S3 (24/05) — campo Departamento reusável pros forms
 * de cadastros operacionais (Software/Licença/Contrato/NF/Ativo/Parada).
 *
 * Comportamento (decisão Clenio):
 *  - **OVERSIGHT_PLATAFORMA** (capability): dropdown com TODOS os deptos
 *    da plataforma — "olho fiscalizador" cria/aloca onde quiser.
 *  - **0 deptos no user** com a funcionalidade ativa: erro "sem deptos
 *    ativos — contate ADMIN".
 *  - **1 depto**: readonly + badge informativo (sem clique, sem dúvida).
 *  - **N deptos**: <select> obrigatório com placeholder "Selecione..."
 *    (escolha consciente).
 *
 * Prop `funcionalidade` filtra os deptos que têm a funcionalidade ativa
 * no toggle do Configurador (ex: `funcionalidade="SOFTWARE"` exibe só
 * deptos com SOFTWARE habilitado).
 */

interface Props {
  value: string;
  onChange: (departamentoId: string) => void;
  /** Funcionalidade Workspace que filtra os deptos elegíveis. */
  funcionalidade?: string;
  /** Quando true, desabilita o select (edição não permitida). */
  disabled?: boolean;
  /** Label visível acima do campo. Default: "Departamento *". */
  label?: string;
  /** Texto de ajuda abaixo do campo. */
  help?: string;
}

const OVERSIGHT_CAP = 'OVERSIGHT_PLATAFORMA';

export function DepartamentoField({
  value,
  onChange,
  funcionalidade,
  disabled = false,
  label = 'Departamento *',
  help,
}: Props) {
  const { usuario } = useAuth();
  const [todosDeptos, setTodosDeptos] = useState<Departamento[]>([]);
  const [loadingTodos, setLoadingTodos] = useState(false);

  const isOversight = useMemo(
    () => usuario?.capabilities?.includes(OVERSIGHT_CAP) ?? false,
    [usuario],
  );

  // Deptos do user no módulo Workspace, filtrados pela funcionalidade.
  const deptosDoUser = useMemo(() => {
    if (!usuario) return [];
    const workspaceMod = usuario.modulos.find((m) => isWorkspaceModulo(m.codigo));
    const deptos = workspaceMod?.departamentos ?? [];
    if (!funcionalidade) return deptos;
    return deptos.filter((d) => d.funcionalidades?.includes(funcionalidade));
  }, [usuario, funcionalidade]);

  // OVERSIGHT busca catálogo completo da plataforma (1 vez por mount).
  useEffect(() => {
    if (!isOversight) return;
    setLoadingTodos(true);
    coreService
      .listarDepartamentos(funcionalidade ? { funcionalidade } : undefined)
      .then(setTodosDeptos)
      .catch(() => setTodosDeptos([]))
      .finally(() => setLoadingTodos(false));
  }, [isOversight, funcionalidade]);

  // Auto-seleção quando 1 depto único (e value ainda não setado).
  useEffect(() => {
    if (isOversight) return;
    if (deptosDoUser.length === 1 && !value) {
      onChange(deptosDoUser[0].id);
    }
  }, [deptosDoUser, value, onChange, isOversight]);

  // ─── Render ─────────────────────────────────────────────────────

  // OVERSIGHT — dropdown com todos os deptos da plataforma.
  if (isOversight) {
    return (
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled || loadingTodos}
          required
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:bg-slate-50 disabled:text-slate-500"
        >
          <option value="">{loadingTodos ? 'Carregando...' : 'Selecione o departamento'}</option>
          {todosDeptos.map((d) => (
            <option key={d.id} value={d.id}>{d.nome}</option>
          ))}
        </select>
        <p className="text-[10px] text-amber-600 mt-1 flex items-center gap-1">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500" />
          Você tem permissão OVERSIGHT — dropdown lista todos os departamentos da plataforma.
        </p>
        {help && <p className="text-xs text-slate-500 mt-1">{help}</p>}
      </div>
    );
  }

  // 0 deptos — erro.
  if (deptosDoUser.length === 0) {
    return (
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
        <div className="w-full border border-red-300 bg-red-50 text-red-700 text-sm rounded-lg px-3 py-2">
          Sem departamentos ativos pra esta funcionalidade. Contate o ADMIN.
        </div>
      </div>
    );
  }

  // 1 depto — readonly + badge.
  if (deptosDoUser.length === 1) {
    const d = deptosDoUser[0];
    return (
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
        <div className="w-full border border-slate-200 bg-slate-50 text-slate-700 text-sm rounded-lg px-3 py-2 flex items-center justify-between">
          <span>{d.nome}</span>
          <span className="text-[10px] text-slate-500 italic">cadastrando neste departamento</span>
        </div>
        {help && <p className="text-xs text-slate-500 mt-1">{help}</p>}
      </div>
    );
  }

  // N deptos — dropdown obrigatório com escolha consciente.
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        required
        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:bg-slate-50 disabled:text-slate-500"
      >
        <option value="">Selecione o departamento</option>
        {deptosDoUser.map((d) => (
          <option key={d.id} value={d.id}>{d.nome}</option>
        ))}
      </select>
      {help && <p className="text-xs text-slate-500 mt-1">{help}</p>}
    </div>
  );
}
