import { useEffect, useState } from 'react';
import { Clock, Send, RotateCcw, CheckCircle2, Lock, Loader2 } from 'lucide-react';
import { countingListService, type HandoffEvent } from '../../../services/counting-list.service';
import type { CountingList } from '../../../types';

interface Props {
  lista: CountingList;
  onClose: () => void;
}

const eventoConfig: Record<string, { label: string; color: string; bgClass: string }> = {
  ENTREGUE:   { label: 'Entregue ao supervisor', color: 'text-purple-700',   bgClass: 'bg-purple-100' },
  DEVOLVIDA:  { label: 'Devolvida ao contador',   color: 'text-amber-700',   bgClass: 'bg-amber-100' },
  FINALIZADA: { label: 'Ciclo finalizado',        color: 'text-blue-700',    bgClass: 'bg-blue-100' },
  ENCERRADA:  { label: 'Lista encerrada',         color: 'text-emerald-700', bgClass: 'bg-emerald-100' },
};

function eventIcon(evento: string) {
  switch (evento) {
    case 'ENTREGUE':   return <Send className="w-4 h-4" />;
    case 'DEVOLVIDA':  return <RotateCcw className="w-4 h-4" />;
    case 'FINALIZADA': return <CheckCircle2 className="w-4 h-4" />;
    case 'ENCERRADA':  return <Lock className="w-4 h-4" />;
    default:           return <Clock className="w-4 h-4" />;
  }
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

export function HistoricoHandoffModal({ lista, onClose }: Props) {
  const [eventos, setEventos] = useState<HandoffEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    countingListService.historicoHandoffs(lista.id)
      .then(setEventos)
      .catch(() => setEventos([]))
      .finally(() => setLoading(false));
  }, [lista.id]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-6 space-y-4 max-h-[85vh] flex flex-col">
        <div>
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Clock className="w-5 h-5 text-slate-600" />
            Historico da lista {lista.list_name}
          </h3>
          <p className="text-sm text-slate-500 mt-1">
            Eventos de entrega, devolucao, finalizacao e encerramento.
          </p>
        </div>

        <div className="text-xs bg-slate-50 rounded-lg p-3 grid grid-cols-3 gap-2">
          <div><span className="text-slate-500">Status atual:</span> <strong className="text-slate-800">{lista.list_status}</strong></div>
          <div><span className="text-slate-500">Ciclo atual:</span> <strong className="text-slate-800">{lista.current_cycle}o</strong></div>
          <div><span className="text-slate-500">Itens:</span> <strong className="text-slate-800">{lista.total_items ?? 0}</strong></div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-slate-400">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              Carregando historico...
            </div>
          ) : eventos.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm">
              Nenhum evento registrado nesta lista ainda.
              <br />
              <span className="text-xs">Eventos surgem quando o contador entrega ou o supervisor devolve a lista.</span>
            </div>
          ) : (
            <ol className="space-y-3">
              {eventos.map((ev, idx) => {
                const cfg = eventoConfig[ev.evento] || { label: ev.evento, color: 'text-slate-700', bgClass: 'bg-slate-100' };
                const isFirst = idx === 0;
                const itensCount = Array.isArray(ev.itens_devolvidos) ? ev.itens_devolvidos.length : 0;
                return (
                  <li
                    key={ev.id}
                    className={`relative pl-10 pb-3 ${idx < eventos.length - 1 ? 'border-l-2 border-slate-200 ml-3' : 'ml-3'}`}
                  >
                    <span className={`absolute -left-[14px] top-0 w-6 h-6 rounded-full flex items-center justify-center ${cfg.bgClass} ${cfg.color}`}>
                      {eventIcon(ev.evento)}
                    </span>
                    <div className={`bg-white border ${isFirst ? 'border-slate-300' : 'border-slate-200'} rounded-lg p-3`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className={`font-semibold text-sm ${cfg.color}`}>{cfg.label}</span>
                        <span className="text-xs text-slate-400">{fmtDate(ev.created_at)}</span>
                      </div>
                      <div className="text-xs text-slate-600 space-y-0.5">
                        <div>Por: <strong>{ev.ator_nome}</strong></div>
                        <div>Ciclo: <strong>{ev.ciclo}o</strong></div>
                        {ev.observacao && (
                          <div>Observacao: <em className="text-slate-700">{ev.observacao}</em></div>
                        )}
                        {ev.evento === 'DEVOLVIDA' && (
                          itensCount > 0 ? (
                            <div className="mt-1 inline-block px-2 py-0.5 bg-amber-50 text-amber-700 rounded text-[11px]">
                              Devolucao parcial: {itensCount} item(ns) marcado(s)
                            </div>
                          ) : (
                            <div className="mt-1 inline-block px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[11px]">
                              Devolucao total (todos os itens contados)
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>

        <div className="flex justify-end pt-2 border-t border-slate-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
