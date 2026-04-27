import type { Dispatch, SetStateAction } from 'react';

/**
 * Resposta paginada padrão do backend gestao-ti.
 * Corresponde ao shape retornado por `paginate(prisma, model, opts)`
 * em `common/prisma/paginate.helper.ts`.
 */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

interface PaginatorProps {
  /** Total de itens (vem do backend como `total`). */
  total: number;
  /** Quantidade de itens exibidos na página atual (pode ser < pageSize na última). */
  shownCount: number;
  /** Página atual (1-indexada). */
  page: number;
  setPage: Dispatch<SetStateAction<number>>;
  /** Tamanho da página. */
  pageSize: number;
  setPageSize: Dispatch<SetStateAction<number>>;
  /** Opções de tamanho de página. Default: [25, 50, 100, 200]. */
  pageSizeOptions?: number[];
  /** Rótulo da entidade no singular + plural. Default: chamado/chamados. */
  labelSingular?: string;
  labelPlural?: string;
}

/**
 * Paginador padrão das listagens do Gestão TI.
 *
 * Aparece apenas quando `total > 0`. Cabeçalho mostra "X–Y de Z <entidade>s"
 * e botões « ‹ › » com select de pageSize.
 *
 * Introduzido em 23/04/2026 junto com o backend helper `paginate()` para
 * padronizar a paginação nas 8 listagens principais (Chamados, OS, Ativos,
 * Licenças, Projetos, Contratos, Paradas, Softwares, Conhecimento).
 */
export function Paginator({
  total,
  shownCount,
  page,
  setPage,
  pageSize,
  setPageSize,
  pageSizeOptions = [25, 50, 100, 200],
  labelSingular = 'item',
  labelPlural = 'itens',
}: PaginatorProps) {
  if (total <= 0) return null;
  const totalPaginas = Math.max(1, Math.ceil(total / pageSize));
  const primeiro = shownCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const ultimo = (page - 1) * pageSize + shownCount;

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm">
      <div className="text-slate-600">
        <span className="font-medium text-slate-800">
          {primeiro}–{ultimo}
        </span>{' '}
        de <span className="font-medium text-slate-800">{total}</span>{' '}
        {total === 1 ? labelSingular : labelPlural}
      </div>

      <div className="flex items-center gap-2">
        <label className="text-xs text-slate-600">
          Por página:
          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            className="ml-2 rounded border border-slate-300 bg-white px-2 py-1 text-xs"
          >
            {pageSizeOptions.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>

        <div className="ml-3 flex items-center gap-1">
          <button
            type="button"
            onClick={() => setPage(1)}
            disabled={page === 1}
            className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            title="Primeira página"
          >
            «
          </button>
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            ‹ Anterior
          </button>
          <span className="px-2 text-xs text-slate-600">
            Pág. <span className="font-medium text-slate-800">{page}</span> de{' '}
            <span className="font-medium text-slate-800">{totalPaginas}</span>
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPaginas, p + 1))}
            disabled={page >= totalPaginas}
            className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Próxima ›
          </button>
          <button
            type="button"
            onClick={() => setPage(totalPaginas)}
            disabled={page >= totalPaginas}
            className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            title="Última página"
          >
            »
          </button>
        </div>
      </div>
    </div>
  );
}
