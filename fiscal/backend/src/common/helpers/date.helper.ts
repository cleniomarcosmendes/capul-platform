/**
 * Parse seguro de data — retorna `null` se input vazio OU resulta em
 * `Invalid Date` (formato inesperado da fonte externa).
 *
 * Bug 25/05/2026: SEFAZ PR retornou CNPJ NEOVIA (18.631.739/0058-00) com
 * data não-vazia mas em formato não-parseável → `new Date()` produzia
 * Invalid Date → Prisma upsert falhou com 500 "Provided Date object is
 * invalid". O `c.inicioAtividade ? new Date(...) : null` era insuficiente
 * porque string não-vazia ainda passa o truthy.
 */
export function parseDateSafe(input: unknown): Date | null {
  if (input == null || input === '') return null;
  const d = new Date(input as string | number | Date);
  return isNaN(d.getTime()) ? null : d;
}
