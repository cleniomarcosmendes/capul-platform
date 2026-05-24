import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { coreService } from '../services/core.service';
import { isWorkspaceModulo } from '../lib/workspace-modulo';
import type { Departamento } from '../types';

/**
 * Workspace Onda 3 S3 (24/05, refinado pós-S7) — campo Departamento
 * reusável pros forms de cadastros operacionais (Software/Licença/Contrato/
 * NF/Ativo/Parada).
 *
 * Comportamento (decisão Clenio):
 *  - **OVERSIGHT_PLATAFORMA** (capability): dropdown com TODOS os deptos
 *    da plataforma. Default: depto do cadastro do user. Olho fiscalizador
 *    cria/aloca onde quiser.
 *  - **0 deptos elegíveis**: erro "sem deptos ativos — contate ADMIN".
 *  - **Demais (1 ou N deptos)**: dropdown SEMPRE — pré-selecionado com
 *    `usuario.departamento.id` (depto do cadastro/principal do user). User
 *    pode mudar se quiser, mas o caso comum é manter o default. Mais
 *    seguro e visualmente consistente do que esconder o dropdown quando
 *    só há 1 opção (decisão pós-S7).
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

  // ─── Lista efetiva pra renderizar dropdown ─────────────────────
  const opcoes = isOversight ? todosDeptos : deptosDoUser;

  // ─── Default = depto do cadastro do user (se estiver na lista) ─
  // Pre-seleciona quando: value vazio + opcoes carregadas + cadastro elegível.
  // Fallback: se cadastro NÃO está na lista (caso raro), pega o primeiro.
  useEffect(() => {
    if (value) return;
    if (opcoes.length === 0) return;
    if (isOversight && loadingTodos) return;
    const cadastroId = usuario?.departamento?.id;
    const cadastroNaLista = cadastroId && opcoes.some((d) => d.id === cadastroId);
    onChange(cadastroNaLista ? cadastroId! : opcoes[0].id);
  }, [value, opcoes, isOversight, loadingTodos, usuario, onChange]);

  // ─── Render ─────────────────────────────────────────────────────

  // 0 deptos elegíveis (sem OVERSIGHT) — erro.
  if (!isOversight && deptosDoUser.length === 0) {
    return (
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
        <div className="w-full border border-red-300 bg-red-50 text-red-700 text-sm rounded-lg px-3 py-2">
          Sem departamentos ativos pra esta funcionalidade. Contate o ADMIN.
        </div>
      </div>
    );
  }

  // Dropdown (caso geral: OVERSIGHT ou user com 1+ deptos).
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled || (isOversight && loadingTodos)}
        required
        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:bg-slate-50 disabled:text-slate-500"
      >
        <option value="">{loadingTodos ? 'Carregando...' : 'Selecione...'}</option>
        {opcoes.map((d) => (
          <option key={d.id} value={d.id}>{d.nome}</option>
        ))}
      </select>
      {isOversight && (
        <p className="text-[10px] text-amber-600 mt-1 flex items-center gap-1">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500" />
          OVERSIGHT — dropdown lista todos os departamentos da plataforma.
        </p>
      )}
      {help && <p className="text-xs text-slate-500 mt-1">{help}</p>}
    </div>
  );
}
