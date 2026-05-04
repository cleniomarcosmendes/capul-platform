/**
 * Sort utilities — table column sorting (client-side, asc/desc/none cycle).
 */

export type SortDir = 'asc' | 'desc' | null;

/**
 * Comparador genérico: numérico se ambos forem números, senão string com locale pt-BR.
 * Trata null/undefined sempre no fim.
 */
export function compareValues(a: unknown, b: unknown): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  // Tenta numérico mesmo em strings ("00010049" < "00010070")
  const na = Number(a);
  const nb = Number(b);
  if (!Number.isNaN(na) && !Number.isNaN(nb) && a !== '' && b !== '') {
    return na - nb;
  }
  return String(a).localeCompare(String(b), 'pt-BR', { numeric: true, sensitivity: 'base' });
}

/**
 * Ordena `rows` por `key` na direção `dir`. Imutável.
 * `key` pode ser uma string apontando para campo do objeto, ou null/dir=null retorna como está.
 */
export function sortBy<T>(rows: T[], key: keyof T | string | null, dir: SortDir): T[] {
  if (!key || !dir) return rows;
  const sorted = [...rows].sort((a, b) =>
    compareValues(
      (a as Record<string, unknown>)[String(key)],
      (b as Record<string, unknown>)[String(key)],
    ),
  );
  return dir === 'asc' ? sorted : sorted.reverse();
}

/**
 * Calcula a próxima direção quando o usuário clica num cabeçalho.
 * Ciclo: asc → desc → null (volta ao default).
 * Trocando coluna sempre começa em asc.
 */
export function nextSortDir(
  currentKey: string | null,
  clickedKey: string,
  currentDir: SortDir,
): SortDir {
  if (currentKey !== clickedKey) return 'asc';
  if (currentDir === 'asc') return 'desc';
  if (currentDir === 'desc') return null;
  return 'asc';
}
