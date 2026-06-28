import type { CSSProperties } from 'react';

// Barra da "Linha do KM" de um veículo (apresentacional, sem fetch). Eixo em
// QUILÔMETROS: cada viagem é um segmento azul (kmInicial→kmFinal) e as lacunas
// entre viagens (e até o KM atual, no mês corrente) aparecem hachuradas como
// "não apontadas" — prestação de contas do odômetro. Tooltip nativo no hover.

export interface SegKm {
  tipo: 'viagem' | 'gap';
  kmInicio: number; kmFim: number; km: number; label: string;
  viagemNumero?: number; data?: string | null; condutor?: string | null;
}
export interface LinhaKm {
  veiculoId: string; placa: string; modelo?: string | null; kmAtual: number;
  kmMin: number; kmMax: number; kmViagens: number; kmNaoApontadas: number;
  qtdViagens: number; segmentos: SegKm[];
}

export const fmtKm = (n: number) => n.toLocaleString('pt-BR');
export const HACHURA = 'repeating-linear-gradient(45deg, #cbd5e1, #cbd5e1 4px, #e2e8f0 4px, #e2e8f0 8px)';
// Paleta cíclica para as viagens — cores alternam para distinguir uma viagem da
// seguinte (início/fim de cada trecho ficam visíveis mesmo quando são contíguos).
export const CORES_VIAGEM = ['#0ea5e9', '#6366f1', '#10b981', '#f59e0b', '#ec4899', '#14b8a6', '#8b5cf6', '#ef4444', '#22c55e', '#eab308'];

// Índice de cor por segmento: cada viagem avança na paleta; lacunas ficam null.
export function coresPorSegmento(segmentos: SegKm[]): (string | null)[] {
  let vi = 0;
  return segmentos.map((s) => (s.tipo === 'viagem' ? CORES_VIAGEM[vi++ % CORES_VIAGEM.length] : null));
}

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
