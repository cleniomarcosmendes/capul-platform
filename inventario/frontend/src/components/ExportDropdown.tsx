import { useState, useRef, useEffect } from 'react';
import { Download, FileSpreadsheet, FileText, Printer } from 'lucide-react';

interface ExportDropdownProps {
  onCSV: () => void;
  onExcel: () => void;
  onPrint: () => void;
  disabled?: boolean;
}

export function ExportDropdown({ onCSV, onExcel, onPrint, disabled }: ExportDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  function handle(fn: () => void) {
    setOpen(false);
    fn();
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        disabled={disabled}
        className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 text-slate-600 text-xs rounded-lg hover:bg-slate-50 disabled:opacity-40"
      >
        <Download className="w-3.5 h-3.5" />
        Exportar
      </button>

      {open && (
        <div className="absolute right-0 mt-1 w-40 bg-white border border-slate-200 rounded-lg shadow-lg z-30 py-1">
          <button
            onClick={() => handle(onCSV)}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            <FileText className="w-4 h-4 text-green-600" />
            CSV
          </button>
          <button
            onClick={() => handle(onExcel)}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            Excel
          </button>
          <button
            onClick={() => handle(onPrint)}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            <Printer className="w-4 h-4 text-slate-600" />
            Imprimir
          </button>
        </div>
      )}
    </div>
  );
}
