import { useState, useRef, useEffect } from 'react';
import { ChevronDown, X } from 'lucide-react';

interface Option {
  value: string;
  label: string;
}

interface MultiSelectDropdownProps {
  options: Option[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
}

export function MultiSelectDropdown({ options, selected, onChange, placeholder = 'Selecione...' }: MultiSelectDropdownProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filtrados = options.filter((o) =>
    !search || o.label.toLowerCase().includes(search.toLowerCase())
  );

  const selectedLabels = selected.map((v) => options.find((o) => o.value === v)?.label).filter(Boolean);

  function toggle(value: string) {
    if (selected.includes(value)) onChange(selected.filter((v) => v !== value));
    else onChange([...selected, value]);
  }

  function removeTag(value: string) {
    onChange(selected.filter((v) => v !== value));
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white text-left flex items-center justify-between gap-2 min-h-[38px]"
      >
        <div className="flex-1 flex flex-wrap gap-1 min-w-0">
          {selected.length === 0 ? (
            <span className="text-slate-400">{placeholder}</span>
          ) : (
            selectedLabels.map((label, i) => (
              <span key={selected[i]} className="inline-flex items-center gap-1 bg-capul-100 text-capul-700 text-xs px-2 py-0.5 rounded-full">
                {label}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); removeTag(selected[i]); }}
                  className="hover:text-capul-900"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))
          )}
        </div>
        <ChevronDown className={`w-4 h-4 text-slate-400 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg">
          {options.length > 5 && (
            <div className="p-2 border-b border-slate-100">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar..."
                className="w-full border border-slate-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-capul-500"
                autoFocus
              />
            </div>
          )}
          <div className="max-h-48 overflow-y-auto p-1">
            {filtrados.length === 0 ? (
              <p className="text-xs text-slate-400 px-3 py-2">Nenhum resultado</p>
            ) : (
              filtrados.map((o) => (
                <label
                  key={o.value}
                  className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 rounded cursor-pointer text-sm"
                >
                  <input
                    type="checkbox"
                    className="rounded border-slate-300 text-capul-600 focus:ring-capul-500"
                    checked={selected.includes(o.value)}
                    onChange={() => toggle(o.value)}
                  />
                  <span className="truncate">{o.label}</span>
                </label>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
