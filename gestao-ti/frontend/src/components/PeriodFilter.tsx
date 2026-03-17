import { useState, type ReactNode } from 'react';
import { Calendar } from 'lucide-react';

type PresetPeriodo = 'mes' | 'trimestre' | 'semestre' | 'anual' | 'personalizado';

interface PeriodFilterProps {
  dataInicio: string;
  dataFim: string;
  onPeriodChange: (inicio: string, fim: string) => void;
  children?: ReactNode;
}

const presets: { value: PresetPeriodo; label: string }[] = [
  { value: 'mes', label: 'Mes' },
  { value: 'trimestre', label: 'Trimestre' },
  { value: 'semestre', label: 'Semestre' },
  { value: 'anual', label: 'Anual' },
  { value: 'personalizado', label: 'Personalizado' },
];

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function calcularPeriodo(preset: PresetPeriodo): { inicio: string; fim: string } | null {
  const hoje = new Date();
  switch (preset) {
    case 'mes': {
      const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
      return { inicio: formatDate(inicio), fim: formatDate(hoje) };
    }
    case 'trimestre': {
      const inicio = new Date(hoje.getFullYear(), hoje.getMonth() - 2, 1);
      return { inicio: formatDate(inicio), fim: formatDate(hoje) };
    }
    case 'semestre': {
      const inicio = new Date(hoje.getFullYear(), hoje.getMonth() - 5, 1);
      return { inicio: formatDate(inicio), fim: formatDate(hoje) };
    }
    case 'anual': {
      const inicio = new Date(hoje.getFullYear(), 0, 1);
      return { inicio: formatDate(inicio), fim: formatDate(hoje) };
    }
    case 'personalizado':
      return null;
  }
}

export function PeriodFilter({ dataInicio, dataFim, onPeriodChange, children }: PeriodFilterProps) {
  const [preset, setPreset] = useState<PresetPeriodo>('mes');

  function handlePreset(p: PresetPeriodo) {
    setPreset(p);
    if (p !== 'personalizado') {
      const periodo = calcularPeriodo(p);
      if (periodo) onPeriodChange(periodo.inicio, periodo.fim);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6">
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <Calendar className="w-4 h-4 text-slate-400" />
        <span className="text-xs text-slate-500 font-medium mr-1">Periodo:</span>
        {presets.map((p) => (
          <button
            key={p.value}
            onClick={() => handlePreset(p.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              preset === p.value
                ? 'bg-capul-600 text-white'
                : 'bg-white border border-slate-300 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs text-slate-500 mb-1">Inicio</label>
          <input
            type="date"
            value={dataInicio}
            onChange={(e) => {
              setPreset('personalizado');
              onPeriodChange(e.target.value, dataFim);
            }}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Fim</label>
          <input
            type="date"
            value={dataFim}
            onChange={(e) => {
              setPreset('personalizado');
              onPeriodChange(dataInicio, e.target.value);
            }}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        {children}
      </div>
    </div>
  );
}
