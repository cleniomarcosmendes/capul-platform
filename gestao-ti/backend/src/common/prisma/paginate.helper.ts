import type { PrismaService } from '../../prisma/prisma.service.js';

/**
 * Shim para as delegates Prisma (prisma.chamado, prisma.ativo, etc.).
 *
 * Prisma gera tipos muito específicos para `count({where})` e `findMany({where, ...})`
 * — cada model tem seus próprios `WhereInput` / `Include` / `Select`. Como queremos
 * um helper genérico, aceitamos as delegates como `any` e validamos a forma em
 * runtime via a assinatura do `paginate()`. Os TSs dos callers continuam
 * checando tipos corretamente nos `where`/`include` que passam.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type PaginableModel = any;

export interface PaginateOptions {
  /** Cláusula Prisma `where` — passada tanto para `count` quanto `findMany`. */
  where?: unknown;
  /** `include` do Prisma (relações). */
  include?: unknown;
  /** `select` do Prisma — mutuamente exclusivo com `include`. */
  select?: unknown;
  /** Ordenação. Default: `{ createdAt: 'desc' }` — cobre a maioria dos casos. */
  orderBy?: unknown;
  /** Página 1-indexada. Default: 1. */
  page?: number;
  /** Tamanho da página. Default: 50. Clamp em [1, 200] para evitar payloads enormes. */
  pageSize?: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * Paginação padrão para listagens do gestao-ti.
 *
 * - Chama `count(where)` e `findMany({ where, include/select, orderBy, skip, take })`
 *   dentro de um `$transaction` para consistência (evita total diferente da
 *   página retornada se houver insert entre as duas queries).
 * - Normaliza `page` >= 1 e `pageSize` em [1, 200].
 *
 * Uso típico em um service:
 *
 * ```ts
 * return paginate<Chamado>(this.prisma, this.prisma.chamado, {
 *   where: { status: 'ABERTO' },
 *   include: chamadoInclude,
 *   orderBy: { createdAt: 'desc' },
 *   page: filters.page,
 *   pageSize: filters.pageSize,
 * });
 * ```
 *
 * Introduzido em 23/04/2026 após o incidente de chamados 500+ em produção,
 * para evitar reescrita de 8 listagens sem padrão consistente.
 */
export async function paginate<T>(
  prisma: PrismaService,
  model: PaginableModel,
  opts: PaginateOptions,
): Promise<PaginatedResult<T>> {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(200, Math.max(1, opts.pageSize ?? 50));

  const findManyArgs: Record<string, unknown> = {
    where: opts.where,
    orderBy: opts.orderBy ?? { createdAt: 'desc' },
    skip: (page - 1) * pageSize,
    take: pageSize,
  };
  if (opts.select) {
    findManyArgs.select = opts.select;
  } else if (opts.include) {
    findManyArgs.include = opts.include;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const queries: any[] = [
    model.count({ where: opts.where }),
    model.findMany(findManyArgs),
  ];
  const [total, items] = (await prisma.$transaction(queries)) as [number, unknown[]];

  return {
    items: items as T[],
    total,
    page,
    pageSize,
  };
}
