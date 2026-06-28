import type { CSSProperties } from 'react';
import { coresPorSegmento, fmtKm, HACHURA, type LinhaKm } from './linhaKm';

// Barra da "Linha do KM" de um veículo (apresentacional, sem fetch). Tipos e
// helpers vivem em ./linhaKm; aqui fica só o componente. Tooltip nativo no hover.

export function LinhaKmBarra({ linha, altura = 'h-7' }: { linha: LinhaKm; altura?: string }) {
  if (linha.segmentos.length === 0) return <p className="text-xs text-slate-400">Sem rotas com KM apontado no período.</p>;

  const span = Math.max(linha.kmMax - linha.kmMin, 1);
  const pos = (km: number) => ((km - linha.kmMin) / span) * 100;
  const cores = coresPorSegmento(linha.segmentos);

  return (
    <div>
      <div className={`relative w-full overflow-hidden rounded bg-slate-100 ${altura}`}>
        {linha.segmentos.map((s, i) => {
          const style: CSSProperties = {
            left: `${pos(s.kmInicio)}%`,
            width: `${Math.max((s.km / span) * 100, 0.5)}%`,
            ...(s.tipo === 'gap'
              ? { backgroundImage: HACHURA }
              : { backgroundColor: cores[i]!, boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.65)' }),
          };
          const cls = s.tipo === 'viagem' ? 'hover:brightness-110' : 'hover:brightness-95';
          const tip = `${s.label} · ${fmtKm(s.kmInicio)}–${fmtKm(s.kmFim)} km (${fmtKm(s.km)} km)`
            + (s.tipo === 'viagem' && s.condutor ? ` · ${s.condutor}` : '');
          return (
            <div key={i} className={`absolute inset-y-0.5 rounded ${cls} cursor-default transition`} style={style} title={tip} />
          );
        })}
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-slate-400">
        <span>{fmtKm(linha.kmMin)} km</span><span>{fmtKm(linha.kmMax)} km</span>
      </div>
    </div>
  );
}
