import { useState, useMemo } from 'react';
import { sortBy, nextSortDir, type SortDir } from '../utils/sort';

/**
 * Hook para ordenação de tabelas client-side.
 *
 * Uso:
 *   const { sortedRows, handleSort, sortKey, sortDir } = useTableSort(rows, 'product_description', 'asc');
 *
 *   <SortableTh label="Código" sortKey="product_code"
 *               currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
 *
 *   {sortedRows.map(...)}
 *
 * @param rows array original (já filtrado por busca, se aplicável)
 * @param initialKey coluna inicial (opcional)
 * @param initialDir direção inicial (opcional)
 * @param onSortChange callback opcional ao trocar (útil pra resetar paginação)
 */
export function useTableSort<T>(
  rows: T[],
  initialKey: string | null = null,
  initialDir: SortDir = null,
  onSortChange?: () => void,
) {
  const [sortKey, setSortKey] = useState<string | null>(initialKey);
  const [sortDir, setSortDir] = useState<SortDir>(initialDir);

  const sortedRows = useMemo(() => sortBy(rows, sortKey, sortDir), [rows, sortKey, sortDir]);

  const handleSort = (key: string) => {
    const dir = nextSortDir(sortKey, key, sortDir);
    setSortKey(dir ? key : null);
    setSortDir(dir);
    if (onSortChange) onSortChange();
  };

  return { sortedRows, sortKey, sortDir, handleSort };
}
