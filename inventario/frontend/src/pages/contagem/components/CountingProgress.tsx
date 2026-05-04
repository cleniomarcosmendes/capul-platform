interface CountingProgressProps {
  total: number;
  counted: number;
  divergent?: number;
  pending?: number;
  compact?: boolean;
}

export function CountingProgress({ total, counted, divergent = 0, compact = false }: CountingProgressProps) {
  const pct = total > 0 ? Math.round((counted / total) * 100) : 0;
  const pending = total - counted;

  const allCounted = total > 0 && pending === 0;

  if (compact) {
    return (
      <div>
        <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
          <span><strong className="text-slate-700">{counted}</strong>/{total} contados</span>
          {allCounted ? (
            <span className="text-green-600 font-medium">Concluído!</span>
          ) : (
            <span className="text-amber-600">{pending} pendentes</span>
          )}
        </div>
        <div className="w-full bg-slate-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all ${allCounted ? 'bg-green-500' : 'bg-capul-600'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <div className="w-full bg-slate-200 rounded-full h-2.5">
            <div
              className="bg-capul-600 h-2.5 rounded-full transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
        <span className="text-sm font-medium text-slate-700 min-w-[50px] text-right">{pct}%</span>
      </div>
      <div className="flex gap-4 text-xs text-slate-500">
        <span>{counted}/{total} contados</span>
        <span>{pending} pendentes</span>
        {divergent > 0 && <span className="text-amber-600">{divergent} divergencias</span>}
      </div>
    </div>
  );
}
