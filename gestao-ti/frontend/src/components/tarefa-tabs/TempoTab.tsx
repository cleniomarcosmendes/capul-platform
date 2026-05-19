import { useState } from 'react';
import { Clock, Check, X, Edit3, Trash2 } from 'lucide-react';
import type { RegistroTempo } from '../../types';
import { EmptyState } from '../EmptyState';

interface TempoTabProps {
  registros: RegistroTempo[];
  loading: boolean;
  totalMinutos: number;
  canAdd: boolean;
  currentUserId: string;
  isGestor: boolean;
  onSalvar: (id: string, payload: { horaInicio?: string; horaFim?: string; observacoes?: string }) => Promise<void>;
  onRemover: (id: string) => Promise<void>;
}

function fmtDuracao(minutos: number | null | undefined): string {
  if (!minutos) return '-';
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return h > 0 ? `${h}h${m > 0 ? ` ${m}min` : ''}` : `${m}min`;
}
function fmtHora(dt: string | null): string {
  if (!dt) return '-';
  return new Date(dt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}
function toLocalDatetimeStr(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Aba "Cronômetro": total + tabela de registros de tempo com edição inline. */
export function TempoTab({ registros, loading, totalMinutos, canAdd, currentUserId, isGestor, onSalvar, onRemover }: TempoTabProps) {
  const [editId, setEditId] = useState<string | null>(null);
  const [editInicio, setEditInicio] = useState('');
  const [editFim, setEditFim] = useState('');
  const [editObs, setEditObs] = useState('');

  function startEdit(r: RegistroTempo) {
    setEditId(r.id);
    setEditInicio(r.horaInicio ? toLocalDatetimeStr(r.horaInicio) : '');
    setEditFim(r.horaFim ? toLocalDatetimeStr(r.horaFim) : '');
    setEditObs(r.observacoes || '');
  }
  async function salvar(id: string) {
    await onSalvar(id, {
      horaInicio: editInicio ? new Date(editInicio).toISOString() : undefined,
      horaFim: editFim ? new Date(editFim).toISOString() : undefined,
      observacoes: editObs || undefined,
    });
    setEditId(null);
  }

  if (loading) return <p className="px-5 py-4 text-xs text-slate-400">Carregando...</p>;
  if (registros.length === 0) {
    return <EmptyState icon={Clock} message="Nenhum registro de tempo ainda" />;
  }

  return (
    <div className="px-5 py-4">
      <div className="flex items-baseline gap-2 mb-3 pb-3 border-b border-slate-200">
        <Clock className="w-4 h-4 text-slate-400 self-center" />
        <span className="text-xl font-semibold text-slate-800">{fmtDuracao(totalMinutos)}</span>
        <span className="text-xs text-slate-500">total · {registros.length} registro(s)</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-slate-500 border-b border-slate-200">
              <th className="pb-2 font-medium">Data</th>
              <th className="pb-2 font-medium">Inicio</th>
              <th className="pb-2 font-medium">Fim</th>
              <th className="pb-2 font-medium">Duracao</th>
              <th className="pb-2 font-medium">Profissional</th>
              <th className="pb-2 font-medium">Obs</th>
              {canAdd && <th className="pb-2 font-medium text-center w-16">Acoes</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {registros.map((r) => editId === r.id ? (
              <tr key={r.id} className="bg-amber-50">
                <td className="py-2 pr-2" colSpan={2}><label className="block text-slate-500 mb-0.5">Inicio</label><input type="datetime-local" value={editInicio} onChange={(e) => setEditInicio(e.target.value)} className="border border-slate-300 rounded px-2 py-1 text-xs w-full" /></td>
                <td className="py-2 pr-2" colSpan={2}><label className="block text-slate-500 mb-0.5">Fim</label><input type="datetime-local" value={editFim} onChange={(e) => setEditFim(e.target.value)} className="border border-slate-300 rounded px-2 py-1 text-xs w-full" /></td>
                <td className="py-2 pr-2" colSpan={2}><label className="block text-slate-500 mb-0.5">Observacao</label><input value={editObs} onChange={(e) => setEditObs(e.target.value)} placeholder="Obs..." className="border border-slate-300 rounded px-2 py-1 text-xs w-full" /></td>
                <td className="py-2 text-center"><div className="flex items-center justify-center gap-1"><button onClick={() => salvar(r.id)} className="text-green-600 hover:text-green-800"><Check className="w-4 h-4" /></button><button onClick={() => setEditId(null)} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button></div></td>
              </tr>
            ) : (
              <tr key={r.id} className={!r.horaFim ? 'bg-green-50/50' : ''}>
                <td className="py-2 pr-2 text-slate-600">{new Date(r.horaInicio).toLocaleDateString('pt-BR')}</td>
                <td className="py-2 pr-2 text-slate-700 font-medium">{fmtHora(r.horaInicio)}</td>
                <td className="py-2 pr-2 text-slate-700 font-medium">{r.horaFim ? fmtHora(r.horaFim) : <span className="text-green-600 animate-pulse">ativo...</span>}</td>
                <td className="py-2 pr-2 text-slate-700 font-medium">{fmtDuracao(r.duracaoMinutos)}</td>
                <td className="py-2 pr-2 text-slate-600">{r.usuario.nome}</td>
                <td className="py-2 pr-2 text-slate-500">{r.observacoes || '-'}</td>
                {canAdd && (() => {
                  const isMeu = r.usuarioId === currentUserId;
                  const timerAtivo = !r.horaFim;
                  const limiteD2 = new Date(); limiteD2.setDate(limiteD2.getDate() - 2); limiteD2.setHours(0, 0, 0, 0);
                  const foraDoPrazo = new Date(r.horaInicio) < limiteD2;
                  const podeEditar = !timerAtivo && (isMeu || isGestor) && (!foraDoPrazo || isGestor);
                  const motivo = timerAtivo ? 'Cronometro ativo' : !isMeu && !isGestor ? 'Registro de outro usuario' : foraDoPrazo && !isGestor ? 'Registro com mais de 2 dias' : '';
                  return (
                    <td className="py-2 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => podeEditar && startEdit(r)} disabled={!podeEditar} className={podeEditar ? 'text-blue-500 hover:text-blue-700' : 'text-slate-300 cursor-not-allowed'} title={motivo || 'Ajustar'}><Edit3 className="w-3.5 h-3.5" /></button>
                        <button onClick={() => podeEditar && onRemover(r.id)} disabled={!podeEditar} className={podeEditar ? 'text-red-400 hover:text-red-600' : 'text-slate-300 cursor-not-allowed'} title={motivo || 'Remover'}><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                  );
                })()}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
