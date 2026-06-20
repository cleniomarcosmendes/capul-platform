import { useEffect, useState, type CSSProperties } from 'react';
import { Loader2 } from 'lucide-react';
import { logisticaApi } from '../services/api';

// "Linha do KM" do veículo — espelha o Acompanhamento (Gantt) do Gestão TI, mas
// com o eixo em QUILÔMETROS: cada viagem é um segmento (kmInicial→kmFinal) e as
// lacunas entre viagens (e até o KM atual) aparecem como "não apontadas".
// Read-only; tooltip no hover mostra a finalidade/faixa.

interface Seg { tipo: 'viagem' | 'gap'; kmInicio: number; kmFim: number; km: number; label: string; viagemNumero?: number; data?: string | null; condutor?: string | null }
interface Hodometro { placa: string; modelo?: string | null; kmAtual: number; kmMin: number; kmMax: number; kmViagens: number; kmNaoApontadas: number; segmentos: Seg[] }

const fmtKm = (n: number) => n.toLocaleString('pt-BR');
const HACHURA = 'repeating-linear-gradient(45deg, #cbd5e1, #cbd5e1 4px, #e2e8f0 4px, #e2e8f0 8px)';

export function HodometroVeiculo({ veiculoId }: { veiculoId: string }) {
  const [data, setData] = useState<Hodometro | null>(null);
  const [loading, setLoading] = useState(true);
  const [hover, setHover] = useState<Seg | null>(null);

  useEffect(() => {
    let ativo = true;
    setLoading(true);
    logisticaApi.get<Hodometro>(`/frota/veiculos/${veiculoId}/hodometro`)
      .then((r) => { if (ativo) setData(r.data); })
      .catch(() => { if (ativo) setData(null); })
      .finally(() => { if (ativo) setLoading(false); });
    return () => { ativo = false; };
  }, [veiculoId]);

  if (loading) return <div className="text-xs text-slate-400"><Loader2 className="inline h-3.5 w-3.5 animate-spin" /> Carregando linha do KM…</div>;
  if (!data || data.segmentos.length === 0) return <p className="text-xs text-slate-400">Sem viagens com KM apontado para montar a linha.</p>;

  const span = Math.max(data.kmMax - data.kmMin, 1);
  const pos = (km: number) => ((km - data.kmMin) / span) * 100;

  return (
    <div>
      <div className="relative h-7 w-full overflow-hidden rounded bg-slate-100">
        {data.segmentos.map((s, i) => {
          const style: CSSProperties = {
            left: `${pos(s.kmInicio)}%`,
            width: `${Math.max((s.km / span) * 100, 0.5)}%`,
            ...(s.tipo === 'gap' ? { backgroundImage: HACHURA } : {}),
          };
          const cls = s.tipo === 'viagem' ? 'bg-sky-500 hover:bg-sky-600' : 'hover:brightness-95';
          return (
            <div key={i} className={`absolute top-0.5 h-6 rounded ${cls} cursor-pointer transition`} style={style}
              onMouseEnter={() => setHover(s)} onMouseLeave={() => setHover(null)}
              title={`${s.label} · ${fmtKm(s.kmInicio)}–${fmtKm(s.kmFim)} km (${fmtKm(s.km)} km)`} />
          );
        })}
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-slate-400"><span>{fmtKm(data.kmMin)} km</span><span>{fmtKm(data.kmMax)} km</span></div>
      <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-slate-600">
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded bg-sky-500" /> Viagens: <b>{fmtKm(data.kmViagens)} km</b></span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded" style={{ backgroundImage: HACHURA }} /> Não apontadas: <b>{fmtKm(data.kmNaoApontadas)} km</b></span>
      </div>
      {hover && (
        <div className="mt-2 rounded-lg bg-slate-800 p-2.5 text-xs text-white">
          <p className="font-semibold">{hover.label}</p>
          <p>{fmtKm(hover.kmInicio)} – {fmtKm(hover.kmFim)} km · {fmtKm(hover.km)} km</p>
          {hover.tipo === 'viagem' && (
            <p className="text-slate-300">Viagem #{hover.viagemNumero}{hover.condutor ? ` · ${hover.condutor}` : ''}{hover.data ? ` · ${new Date(hover.data).toLocaleDateString('pt-BR')}` : ''}</p>
          )}
        </div>
      )}
    </div>
  );
}
