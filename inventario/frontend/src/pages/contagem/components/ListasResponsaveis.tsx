import type { CountingList } from '../../../types';

interface Props {
  listas: CountingList[];
  counterNames: Record<string, string>;
}

const listStatusConfig: Record<string, { label: string; color: string }> = {
  PREPARACAO:  { label: 'Preparacao', color: 'bg-slate-100 text-slate-600' },
  ABERTA:      { label: 'Aberta', color: 'bg-sky-100 text-sky-700' },
  LIBERADA:    { label: 'Liberada', color: 'bg-blue-100 text-blue-700' },
  EM_CONTAGEM: { label: 'Em Contagem', color: 'bg-amber-100 text-amber-700' },
  ENCERRADA:   { label: 'Encerrada', color: 'bg-green-100 text-green-700' },
};

function getCounterIdForCycle(l: CountingList, cycle: number): string | null {
  if (cycle === 2) return l.counter_cycle_2;
  if (cycle === 3) return l.counter_cycle_3;
  return l.counter_cycle_1;
}

function shortId(id: string): string {
  return id.slice(0, 8);
}

export function ListasResponsaveis({ listas, counterNames }: Props) {
  if (listas.length === 0) {
    return (
      <p className="text-sm text-slate-400 mt-2">
        Este inventario ainda nao tem listas de contagem.
      </p>
    );
  }

  return (
    <div className="mt-6 max-w-3xl mx-auto bg-white rounded-lg border border-slate-200 overflow-hidden text-left">
      <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50">
        <p className="text-sm font-medium text-slate-700">Listas deste inventario</p>
        <p className="text-xs text-slate-500">Veja para quem cada lista esta atribuida.</p>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-slate-50/60 text-[11px] uppercase tracking-wide text-slate-500">
          <tr>
            <th className="text-left py-2 px-3 font-medium">Lista</th>
            <th className="text-left py-2 px-3 font-medium">Status</th>
            <th className="text-center py-2 px-3 font-medium">Ciclo</th>
            <th className="text-left py-2 px-3 font-medium">Responsavel (ciclo atual)</th>
          </tr>
        </thead>
        <tbody>
          {listas.map((l) => {
            const lsc = listStatusConfig[l.list_status] || listStatusConfig.PREPARACAO;
            const cycle = l.current_cycle || 1;
            const counterId = getCounterIdForCycle(l, cycle);
            const counterLabel = counterId
              ? (counterNames[counterId] || shortId(counterId))
              : 'Sem responsavel';
            return (
              <tr key={l.id} className="border-t border-slate-100">
                <td className="py-2 px-3 text-slate-800">{l.list_name}</td>
                <td className="py-2 px-3">
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${lsc.color}`}>
                    {lsc.label}
                  </span>
                </td>
                <td className="py-2 px-3 text-center text-slate-600 font-mono text-xs">
                  {cycle}o
                </td>
                <td className="py-2 px-3 text-slate-700">
                  {counterLabel}
                  {!counterId && (
                    <span className="ml-1 text-xs text-slate-400">(atribua um contador)</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
