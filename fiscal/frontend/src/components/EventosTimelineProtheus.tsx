import {
  CheckCircle2,
  FileEdit,
  FileText,
  Info,
  PackageCheck,
  ShieldCheck,
  Truck,
} from 'lucide-react';
import type { EventoProtheusNfe, OrigemEventoProtheus } from '../types';

interface Props {
  timeline: EventoProtheusNfe[];
  alertasEntrada?: EventoProtheusNfe[];
}

/**
 * Timeline cronológica de eventos de uma NF-e vinda do Protheus via
 * `/eventosNfe` (contrato 18/04/2026). Formato distinto do componente legado
 * `EventosTimeline` (que consome o fluxo SEFAZ direto com tpEvento/cStat).
 *
 * Regra interna: SF1010 (entrada fiscal no Protheus) é exibida em bloco
 * separado `alertasEntrada`, fora da timeline estrita — ver memory
 * `feedback_fiscal_timeline_so_sped`.
 */
export function EventosTimelineProtheus({ timeline, alertasEntrada = [] }: Props) {
  if (timeline.length === 0 && alertasEntrada.length === 0) {
    return (
      <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        <div className="flex items-start gap-3">
          <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-500" />
          <div>
            <p className="font-medium text-slate-700">Nenhum evento registrado no Protheus.</p>
            <p className="mt-1 text-xs">
              A chave ainda não tem eventos nas tabelas SPED150/SPED156 nem XML gravado na SZR010.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {timeline.length > 0 && (
        <ol className="relative space-y-4 border-l-2 border-slate-200 pl-6">
          {timeline.map((ev, idx) => {
            const Icone = iconeParaOrigem(ev.origem);
            const cor = corParaOrigem(ev.origem);
            return (
              <li key={`${ev.origem}-${ev.quando}-${idx}`} className="relative">
                <span
                  className={`absolute -left-[34px] top-0 flex h-7 w-7 items-center justify-center rounded-full ring-4 ring-white ${cor.bg}`}
                >
                  <Icone className={`h-3.5 w-3.5 ${cor.text}`} />
                </span>
                <div className="rounded-md border border-slate-200 bg-white p-3 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-900">{ev.tipo}</span>
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-600">
                          {ev.origem}
                        </span>
                      </div>
                      {ev.detalhes && (
                        <p className="mt-0.5 text-xs text-slate-600">{ev.detalhes}</p>
                      )}
                      <p className="mt-0.5 text-[11px] uppercase tracking-wide text-slate-400">
                        Origem: {ev.ator}
                      </p>
                    </div>
                    <time className="whitespace-nowrap text-xs text-slate-500">
                      {formatarQuando(ev.quando)}
                    </time>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {alertasEntrada.length > 0 && (
        <div className="rounded-md border border-blue-200 bg-blue-50 p-4">
          <div className="mb-2 flex items-center gap-2">
            <PackageCheck className="h-4 w-4 text-blue-700" />
            <h4 className="text-sm font-semibold text-blue-900">
              Entrada fiscal registrada no Protheus
            </h4>
          </div>
          <ul className="space-y-2 text-xs text-blue-900">
            {alertasEntrada.map((ev, idx) => (
              <li key={`sf1010-${idx}`} className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{ev.tipo}</p>
                  {ev.detalhes && <p className="text-blue-800">{ev.detalhes}</p>}
                </div>
                <time className="whitespace-nowrap text-blue-700">
                  {formatarQuando(ev.quando)}
                </time>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/**
 * Converte `YYYYMMDD HH:MM:SS` (formato Protheus) em string localizada
 * `DD/MM/YYYY HH:MM`.
 */
function formatarQuando(quando: string): string {
  if (!quando) return '';
  const match = quando.match(/^(\d{4})(\d{2})(\d{2})(?:\s+(\d{2}):(\d{2}))?/);
  if (!match) return quando;
  const [, y, m, d, h, min] = match;
  return h ? `${d}/${m}/${y} ${h}:${min}` : `${d}/${m}/${y}`;
}

function iconeParaOrigem(origem: OrigemEventoProtheus) {
  if (origem === 'SPED156') return CheckCircle2;
  if (origem === 'SPED156/CCE') return FileEdit;
  if (origem === 'SPED150') return ShieldCheck;
  if (origem === 'SZR010') return FileText;
  if (origem === 'SF1010') return PackageCheck;
  return Truck;
}

function corParaOrigem(origem: OrigemEventoProtheus): { bg: string; text: string } {
  if (origem === 'SPED156') return { bg: 'bg-emerald-100', text: 'text-emerald-700' };
  if (origem === 'SPED156/CCE') return { bg: 'bg-amber-100', text: 'text-amber-700' };
  if (origem === 'SPED150') return { bg: 'bg-indigo-100', text: 'text-indigo-700' };
  if (origem === 'SZR010') return { bg: 'bg-slate-100', text: 'text-slate-700' };
  if (origem === 'SF1010') return { bg: 'bg-blue-100', text: 'text-blue-700' };
  return { bg: 'bg-slate-100', text: 'text-slate-500' };
}

