import {
  AlertTriangle,
  CheckCircle2,
  FileEdit,
  FileX,
  Info,
  MapPin,
  PackageCheck,
  ShieldCheck,
  Truck,
  XCircle,
} from 'lucide-react';
import type { TimelineEvento, ConsultaProtocoloStatus } from '../types';

interface Props {
  eventos: TimelineEvento[];
  consultaProtocoloStatus?: ConsultaProtocoloStatus;
}

/**
 * Timeline cronológica de eventos de uma NF-e / CT-e.
 * Lê a lista de eventos já ordenada do backend (asc por dataEvento) e
 * renderiza cada entrada com ícone + metadata. O protocolo inicial
 * (AUTORIZACAO) aparece como o primeiro marker.
 */
export function EventosTimeline({ eventos, consultaProtocoloStatus }: Props) {
  if (eventos.length === 0) {
    return (
      <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        <div className="flex items-start gap-3">
          <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-500" />
          <div>
            <p className="font-medium text-slate-700">Nenhum evento registrado.</p>
            {consultaProtocoloStatus && !consultaProtocoloStatus.sucesso ? (
              <p className="mt-1 text-xs">
                Não foi possível enriquecer com dados da SEFAZ:{' '}
                <span className="text-slate-500">{consultaProtocoloStatus.erro}</span>
              </p>
            ) : (
              <p className="mt-1 text-xs">
                O documento não possui protocolo ou eventos registrados na SEFAZ.
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {consultaProtocoloStatus && !consultaProtocoloStatus.sucesso && (
        <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <div>
            <p className="font-medium">
              Consulta ao CteConsultaProtocolo/NfeConsultaProtocolo falhou.
            </p>
            <p className="mt-0.5 text-amber-800">
              Exibindo eventos persistidos anteriormente. Erro: {consultaProtocoloStatus.erro}
            </p>
          </div>
        </div>
      )}

      <ol className="relative space-y-4 border-l-2 border-slate-200 pl-6">
        {eventos.map((e, idx) => {
          const Icone = iconeParaTipo(e.tipoEvento);
          const cor = corParaTipo(e.tipoEvento);
          return (
            <li key={`${e.tipoEvento}-${e.dataEvento}-${idx}`} className="relative">
              <span
                className={`absolute -left-[34px] top-0 flex h-7 w-7 items-center justify-center rounded-full ring-4 ring-white ${cor.bg}`}
              >
                <Icone className={`h-3.5 w-3.5 ${cor.text}`} />
              </span>

              <div className="rounded-md border border-slate-200 bg-white p-3 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-900">
                        {e.tipoEventoLabel}
                      </span>
                      {e.tipoEvento !== 'AUTORIZACAO' && (
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-600">
                          tpEvento {e.tipoEvento}
                        </span>
                      )}
                    </div>
                    {e.descricao && e.descricao !== e.tipoEventoLabel && (
                      <p className="mt-0.5 text-xs text-slate-600">{e.descricao}</p>
                    )}
                  </div>
                  <time className="whitespace-nowrap text-xs text-slate-500">
                    {new Date(e.dataEvento).toLocaleString('pt-BR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </time>
                </div>

                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500">
                  {e.protocolo && (
                    <span>
                      <span className="text-slate-400">Protocolo:</span>{' '}
                      <span className="font-mono text-slate-700">{e.protocolo}</span>
                    </span>
                  )}
                  {e.cStat && (
                    <span>
                      <span className="text-slate-400">cStat:</span>{' '}
                      <span className="font-mono text-slate-700">{e.cStat}</span>
                    </span>
                  )}
                  {e.xMotivo && e.xMotivo !== e.descricao && (
                    <span className="w-full text-slate-600">
                      <span className="text-slate-400">Motivo:</span> {e.xMotivo}
                    </span>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function iconeParaTipo(tipo: string) {
  if (tipo === 'AUTORIZACAO') return ShieldCheck;
  if (tipo.startsWith('1101')) {
    // 110110=CCe, 110111=Cancelamento, 110140=EPEC
    if (tipo === '110111' || tipo === '110112') return XCircle;
    if (tipo === '110110') return FileEdit;
    if (tipo === '110180' || tipo === '110190') return PackageCheck;
    if (tipo === '110181' || tipo === '110191') return FileX;
    return CheckCircle2;
  }
  if (tipo.startsWith('2102')) {
    // Manifestação do destinatário
    if (tipo === '210200') return CheckCircle2;
    if (tipo === '210220' || tipo === '210240') return XCircle;
    return Info;
  }
  if (tipo.startsWith('31')) return Truck; // MDF-e vinculado
  if (tipo.startsWith('51')) return MapPin; // Registro de passagem
  if (tipo.startsWith('61')) return AlertTriangle; // Prestação em desacordo
  return Info;
}

function corParaTipo(tipo: string): { bg: string; text: string } {
  if (tipo === 'AUTORIZACAO') return { bg: 'bg-green-100', text: 'text-green-700' };
  if (tipo === '110111' || tipo === '110112' || tipo === '110181' || tipo === '110191') {
    return { bg: 'bg-red-100', text: 'text-red-700' };
  }
  if (tipo === '110110' || tipo === '110180' || tipo === '110190') {
    return { bg: 'bg-blue-100', text: 'text-blue-700' };
  }
  if (tipo.startsWith('2102')) return { bg: 'bg-purple-100', text: 'text-purple-700' };
  if (tipo.startsWith('31') || tipo.startsWith('51')) {
    return { bg: 'bg-amber-100', text: 'text-amber-700' };
  }
  if (tipo.startsWith('61')) return { bg: 'bg-orange-100', text: 'text-orange-700' };
  return { bg: 'bg-slate-100', text: 'text-slate-700' };
}
