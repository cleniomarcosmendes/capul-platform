import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import type { SortDir } from '../utils/sort';

type Props = {
  label: string;
  sortKey: string;
  currentKey: string | null;
  currentDir: SortDir;
  onSort: (key: string) => void;
  align?: 'left' | 'center' | 'right';
  title?: string;
  className?: string;
};

/**
 * Cabeçalho de tabela ordenável. Click cicla asc → desc → reset.
 * Setinha de cor "capul" só aparece na coluna ativa; senão fica neutra.
 */
export function SortableTh({
  label, sortKey, currentKey, currentDir, onSort, align = 'left', title, className,
}: Props) {
  const active = currentKey === sortKey && currentDir !== null;
  const Icon = active ? (currentDir === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;
  return (
    <th
      onClick={() => onSort(sortKey)}
      title={title}
      className={`py-2 px-2 text-slate-500 cursor-pointer select-none hover:bg-slate-100 transition-colors text-${align} ${className || ''}`}
    >
      <span className={`inline-flex items-center gap-1 ${align === 'right' ? 'flex-row-reverse' : ''}`}>
        {label}
        <Icon className={`w-3 h-3 ${active ? 'text-capul-600' : 'text-slate-300'}`} />
      </span>
    </th>
  );
}
