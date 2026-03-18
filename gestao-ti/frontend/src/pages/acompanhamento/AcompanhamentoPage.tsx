import { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Header } from '../../layouts/Header';
import { useAuth } from '../../contexts/AuthContext';
import { dashboardService } from '../../services/dashboard.service';
import {
  Clock, Ticket, FolderKanban, TrendingUp, AlertTriangle,
  Layers, Coffee, Zap, BarChart3, User, Calendar,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { AcompanhamentoData, TecnicoResumo, TimelineItem } from '../../types';

const DEFAULT_HORA_INICIO = 7;
const DEFAULT_HORA_FIM = 20;

/** Formata horas decimais para "Xh YYmin" (ex: 8.8 → "8h 48min") */
function fmtHoras(decimal: number): string {
  const h = Math.floor(decimal);
  const m = Math.round((decimal - h) * 60);
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m.toString().padStart(2, '0')}min`;
}

function formatMin(min: number): string {
  if (min < 1) return '< 1m';
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function formatHora(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function formatData(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });
}

function formatDataCurta(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function hoje(): string {
  return new Date().toISOString().slice(0, 10);
}

function getDateKey(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

// KPI Card
function KpiCard({ label, value, sub, icon: Icon, color }: {
  label: string; value: string | number; sub?: string; icon: LucideIcon; color: string;
}) {
  return (
    <div className="bg-white rounded-xl p-4 border border-slate-200">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-slate-500 uppercase">{label}</span>
        <Icon className={`w-5 h-5 ${color}`} />
      </div>
      <p className="text-2xl font-bold text-slate-800">{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  );
}

// Gantt bar position calculator
function calcBarStyle(horaInicio: string, horaFim: string | null, hIni: number, hFim: number): { left: string; width: string } | null {
  const totalH = hFim - hIni;
  const ini = new Date(horaInicio);
  let end: Date;
  if (horaFim) {
    end = new Date(horaFim);
  } else {
    // Entrada "ativa" — verificar se é de hoje ou de dia passado
    const now = new Date();
    const isToday = ini.toDateString() === now.toDateString();
    if (isToday) {
      end = now;
    } else {
      // Dia passado: estender até o fim do expediente daquele dia
      end = new Date(ini);
      end.setHours(hFim, 0, 0, 0);
    }
  }
  const iniHour = ini.getHours() + ini.getMinutes() / 60;
  const endHour = end.getHours() + end.getMinutes() / 60;
  const clampIni = Math.max(iniHour, hIni);
  const clampEnd = Math.min(endHour, hFim);
  if (clampEnd <= clampIni) return null;
  const left = ((clampIni - hIni) / totalH) * 100;
  const width = ((clampEnd - clampIni) / totalH) * 100;
  return { left: `${left}%`, width: `${Math.max(width, 0.5)}%` };
}

function calcZoneStyle(zoneIni: number, zoneFim: number, hIni: number, hFim: number): { left: string; width: string } {
  const totalH = hFim - hIni;
  const left = ((Math.max(zoneIni, hIni) - hIni) / totalH) * 100;
  const width = ((Math.min(zoneFim, hFim) - Math.max(zoneIni, hIni)) / totalH) * 100;
  return { left: `${left}%`, width: `${Math.max(width, 0)}%` };
}

// Group timeline items by unique entity
function groupTimeline(items: TimelineItem[]): { key: string; label: string; tipo: 'chamado' | 'atividade'; segments: TimelineItem[] }[] {
  const map = new Map<string, { label: string; tipo: 'chamado' | 'atividade'; segments: TimelineItem[] }>();
  for (const item of items) {
    const key = `${item.tipo}-${item.referencia}`;
    const existing = map.get(key);
    if (existing) {
      existing.segments.push(item);
    } else {
      map.set(key, { label: item.titulo, tipo: item.tipo, segments: [item] });
    }
  }
  return Array.from(map.entries()).map(([key, v]) => ({ key, ...v }));
}

// Group timeline items by date
function groupByDate(items: TimelineItem[]): Map<string, TimelineItem[]> {
  const map = new Map<string, TimelineItem[]>();
  for (const item of items) {
    const dateKey = getDateKey(item.horaInicio);
    const arr = map.get(dateKey) || [];
    arr.push(item);
    map.set(dateKey, arr);
  }
  return new Map([...map.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

// Group gaps by date
function groupGapsByDate(gaps: AcompanhamentoData['gaps']): Map<string, AcompanhamentoData['gaps']> {
  const map = new Map<string, AcompanhamentoData['gaps']>();
  for (const gap of gaps) {
    const dateKey = getDateKey(gap.inicio);
    const arr = map.get(dateKey) || [];
    arr.push(gap);
    map.set(dateKey, arr);
  }
  return map;
}

// Inline Gantt for a single day
function DayTimeline({ items, gaps, horarioIni, horarioFim, totalHoras, horas, horario, setHoveredItem }: {
  items: TimelineItem[];
  gaps: AcompanhamentoData['gaps'];
  horarioIni: number;
  horarioFim: number;
  totalHoras: number;
  horas: number[];
  horario: AcompanhamentoData['horario'];
  setHoveredItem: (item: TimelineItem | null) => void;
}) {
  const grouped = groupTimeline(items);

  return (
    <div className="min-w-[800px]">
      {/* Header de horas */}
      <div className="flex border-b border-slate-200 pb-1 mb-1">
        <div className="w-52 flex-shrink-0" />
        <div className="flex-1 relative h-4">
          {horas.map((h) => (
            <div
              key={h}
              className="absolute text-[10px] text-slate-400 font-medium"
              style={{ left: `${((h - horarioIni) / totalHoras) * 100}%` }}
            >
              {String(h).padStart(2, '0')}:00
            </div>
          ))}
        </div>
      </div>

      {/* Rows */}
      {grouped.map((row) => (
        <div key={row.key} className="flex items-center group hover:bg-slate-50/50 rounded">
          <div className="w-52 flex-shrink-0 py-1 pr-2 flex items-center gap-1.5">
            {row.tipo === 'chamado' ? (
              <Ticket className="w-3 h-3 text-orange-500 flex-shrink-0" />
            ) : (
              <FolderKanban className="w-3 h-3 text-purple-500 flex-shrink-0" />
            )}
            <span className="text-[11px] text-slate-700 truncate" title={row.label}>{row.label}</span>
          </div>
          <div className="flex-1 relative h-6">
            {/* Zona de almoço */}
            {(() => {
              const zs = calcZoneStyle(horario.inicioAlmoco, horario.fimAlmoco, horarioIni, horarioFim);
              return <div className="absolute top-0 bottom-0 bg-amber-50/60" style={{ left: zs.left, width: zs.width }} />;
            })()}
            {horas.map((h) => (
              <div key={h} className="absolute top-0 bottom-0 border-l border-slate-100" style={{ left: `${((h - horarioIni) / totalHoras) * 100}%` }} />
            ))}
            {row.segments.map((seg) => {
              const style = calcBarStyle(seg.horaInicio, seg.horaFim, horarioIni, horarioFim);
              if (!style) return null;
              const isShort = (seg.duracaoMinutos ?? 0) <= 30;
              const bgBase = seg.tipo === 'chamado' ? 'bg-orange-500' : 'bg-purple-500';
              const bgHover = seg.tipo === 'chamado' ? 'hover:bg-orange-600' : 'hover:bg-purple-600';
              const border = seg.tipo === 'chamado' ? 'border-orange-600' : 'border-purple-600';
              const timeLabel = formatHora(seg.horaInicio);
              return (
                <div
                  key={seg.id}
                  className={`absolute top-0.5 h-5 rounded ${bgBase} ${bgHover} ${isShort ? `border ${border}` : ''} cursor-pointer transition-colors shadow-sm z-10 flex items-center justify-center overflow-hidden`}
                  style={{ left: style.left, width: style.width, minWidth: isShort ? '10px' : '4px' }}
                  onMouseEnter={() => setHoveredItem(seg)}
                  onMouseLeave={() => setHoveredItem(null)}
                  title={`${timeLabel} — ${seg.horaFim ? formatHora(seg.horaFim) : '...'} (${seg.duracaoMinutos ? formatMin(seg.duracaoMinutos) : 'ativo'})`}
                >
                  <span className="text-[9px] text-white/90 font-medium whitespace-nowrap px-0.5 hidden group-hover:inline">{timeLabel}</span>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Gaps */}
      {gaps.length > 0 && (
        <div className="flex items-center">
          <div className="w-52 flex-shrink-0 py-1 pr-2 flex items-center gap-1.5">
            <Coffee className="w-3 h-3 text-slate-400 flex-shrink-0" />
            <span className="text-[11px] text-slate-400 italic">Intervalos</span>
          </div>
          <div className="flex-1 relative h-6">
            {horas.map((h) => (
              <div key={h} className="absolute top-0 bottom-0 border-l border-slate-100" style={{ left: `${((h - horarioIni) / totalHoras) * 100}%` }} />
            ))}
            {gaps.map((gap, i) => {
              const style = calcBarStyle(gap.inicio, gap.fim, horarioIni, horarioFim);
              if (!style) return null;
              const isAlmoco = gap.tipo === 'almoco';
              return (
                <div
                  key={i}
                  className={`absolute top-0.5 h-5 rounded border border-dashed ${isAlmoco ? 'bg-amber-100 border-amber-300' : 'bg-slate-200 border-slate-300'}`}
                  style={{ left: style.left, width: style.width, minWidth: '4px' }}
                  title={`${isAlmoco ? 'Almoco' : 'Ocioso'}: ${formatHora(gap.inicio)} — ${formatHora(gap.fim)} (${formatMin(gap.duracaoMinutos)})`}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// Day summary bar for consolidated view
function DaySummaryBar({ dateKey, items, horarioIni, horarioFim, totalHoras, horas, horario }: {
  dateKey: string;
  items: TimelineItem[];
  horarioIni: number;
  horarioFim: number;
  totalHoras: number;
  horas: number[];
  horario: AcompanhamentoData['horario'];
}) {
  const totalMin = items.reduce((s, i) => s + (i.duracaoMinutos ?? 0), 0);
  const chamados = items.filter((i) => i.tipo === 'chamado').length;
  const atividades = items.filter((i) => i.tipo === 'atividade').length;

  return (
    <div className="flex items-center group hover:bg-slate-50/50 rounded">
      <div className="w-52 flex-shrink-0 py-1 pr-2">
        <span className="text-xs font-medium text-slate-700">{formatData(dateKey + 'T12:00:00')}</span>
        <span className="text-[10px] text-slate-400 ml-2">{formatMin(totalMin)}</span>
        {chamados > 0 && <span className="text-[10px] text-orange-500 ml-1">({chamados}ch</span>}
        {atividades > 0 && <span className="text-[10px] text-purple-500">{chamados > 0 ? '+' : '('}{atividades}at</span>}
        {(chamados > 0 || atividades > 0) && <span className="text-[10px] text-slate-400">)</span>}
      </div>
      <div className="flex-1 relative h-6">
        {(() => {
          const zs = calcZoneStyle(horario.inicioAlmoco, horario.fimAlmoco, horarioIni, horarioFim);
          return <div className="absolute top-0 bottom-0 bg-amber-50/60" style={{ left: zs.left, width: zs.width }} />;
        })()}
        {horas.map((h) => (
          <div key={h} className="absolute top-0 bottom-0 border-l border-slate-100" style={{ left: `${((h - horarioIni) / totalHoras) * 100}%` }} />
        ))}
        {items.map((seg) => {
          const style = calcBarStyle(seg.horaInicio, seg.horaFim, horarioIni, horarioFim);
          if (!style) return null;
          const isShort = (seg.duracaoMinutos ?? 0) <= 30;
          const bg = seg.tipo === 'chamado' ? 'bg-orange-400' : 'bg-purple-400';
          const border = seg.tipo === 'chamado' ? 'border-orange-500' : 'border-purple-500';
          return (
            <div key={seg.id} className={`absolute top-0.5 h-5 rounded ${bg} ${isShort ? `border ${border}` : ''} opacity-80 z-10`}
              style={{ left: style.left, width: style.width, minWidth: isShort ? '8px' : '3px' }}
              title={`${seg.titulo}: ${formatHora(seg.horaInicio)}–${seg.horaFim ? formatHora(seg.horaFim) : '...'}`}
            />
          );
        })}
      </div>
    </div>
  );
}

export function AcompanhamentoPage() {
  const { gestaoTiRole, usuario } = useAuth();
  const [searchParams] = useSearchParams();
  const paramTecnico = searchParams.get('tecnico');

  const [tecnicos, setTecnicos] = useState<TecnicoResumo[]>([]);
  const [tecnicoId, setTecnicoId] = useState(paramTecnico || '');
  const [dataInicio, setDataInicio] = useState(hoje());
  const [dataFim, setDataFim] = useState(hoje());
  const [data, setData] = useState<AcompanhamentoData | null>(null);
  const [loading, setLoading] = useState(false);
  const [hoveredItem, setHoveredItem] = useState<TimelineItem | null>(null);

  const isManager = ['ADMIN', 'GESTOR_TI'].includes(gestaoTiRole || '');

  useEffect(() => {
    dashboardService.getTecnicos().then(setTecnicos).catch(() => {});
  }, []);

  useEffect(() => {
    if (!isManager && usuario?.id) {
      setTecnicoId(usuario.id);
    }
  }, [isManager, usuario]);

  useEffect(() => {
    // Não-managers: aguardar tecnicoId ser setado com o ID do usuário antes de carregar
    if (!isManager && !tecnicoId) return;

    setLoading(true);
    dashboardService
      .getAcompanhamento({ usuarioId: tecnicoId || undefined, dataInicio, dataFim })
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [tecnicoId, dataInicio, dataFim, isManager]);

  const isMultiDay = dataInicio !== dataFim;
  const timelineByDate = useMemo(() => data ? groupByDate(data.timeline) : new Map(), [data]);
  const gapsByDate = useMemo(() => data ? groupGapsByDate(data.gaps) : new Map(), [data]);

  const horarioIni = data ? Math.floor(data.horario.inicioExpediente) - 1 : DEFAULT_HORA_INICIO;
  const horarioFim = data ? Math.ceil(data.horario.fimExpediente) + 1 : DEFAULT_HORA_FIM;
  const totalHoras = horarioFim - horarioIni;

  const horas = useMemo(() => {
    const arr: number[] = [];
    for (let h = horarioIni; h <= horarioFim; h++) arr.push(h);
    return arr;
  }, [horarioIni, horarioFim]);

  // Heatmap calculado no frontend (timezone correto do browser)
  const distribuicaoPorHora = useMemo(() => {
    if (!data) return [];
    const dist: { hora: number; minutos: number }[] = [];
    for (let h = 0; h < 24; h++) dist.push({ hora: h, minutos: 0 });
    for (const r of data.timeline) {
      if (!r.horaFim) continue;
      const rIni = new Date(r.horaInicio);
      const rFim = new Date(r.horaFim);
      for (let h = 0; h < 24; h++) {
        const slotIni = new Date(rIni);
        slotIni.setHours(h, 0, 0, 0);
        const slotFim = new Date(rIni);
        slotFim.setHours(h + 1, 0, 0, 0);
        const overlapStart = Math.max(rIni.getTime(), slotIni.getTime());
        const overlapEnd = Math.min(rFim.getTime(), slotFim.getTime());
        if (overlapStart < overlapEnd) {
          dist[h].minutos += Math.round((overlapEnd - overlapStart) / 60000);
        }
      }
    }
    return dist.filter((h) => h.minutos > 0 || (h.hora >= horarioIni && h.hora <= horarioFim));
  }, [data, horarioIni, horarioFim]);

  const distChamados = data ? data.resumo.totalMinutosChamados : 0;
  const distAtividades = data ? data.resumo.totalMinutosAtividades : 0;
  const distTotal = distChamados + distAtividades;
  const pctChamados = distTotal > 0 ? Math.round((distChamados / distTotal) * 100) : 0;
  const pctAtividades = distTotal > 0 ? 100 - pctChamados : 0;

  return (
    <>
      <Header title="Acompanhamento do Tecnico" />
      <main className="p-6 space-y-6">
        {/* Filtros */}
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex flex-wrap items-end gap-4">
            {isManager && (
              <div className="flex-1 min-w-[200px]">
                <label className="block text-xs font-medium text-slate-500 mb-1">Tecnico</label>
                <select
                  value={tecnicoId}
                  onChange={(e) => setTecnicoId(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-capul-500 focus:border-capul-500"
                >
                  <option value="">Todos os tecnicos</option>
                  {tecnicos.map((t) => (
                    <option key={t.id} value={t.id}>{t.nome}</option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Data Inicio</label>
              <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)}
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-capul-500 focus:border-capul-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Data Fim</label>
              <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)}
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-capul-500 focus:border-capul-500" />
            </div>
            <button onClick={() => { setDataInicio(hoje()); setDataFim(hoje()); }}
              className="px-3 py-2 text-sm text-capul-600 hover:bg-capul-50 rounded-lg border border-capul-200">
              Hoje
            </button>
          </div>
        </div>

        {loading && <div className="text-center text-slate-500 py-8">Carregando...</div>}

        {!loading && data && (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              <KpiCard label="Horas Trabalhadas" value={fmtHoras(data.resumo.totalHorasTrabalhadas)}
                sub={`de ${fmtHoras(data.resumo.horasDisponiveis)} uteis (${fmtHoras(data.horario.horasUteis)}/dia)`}
                icon={Clock} color="text-blue-600" />
              <KpiCard label="Taxa Ocupacao" value={`${data.resumo.taxaOcupacao}%`}
                sub={data.resumo.taxaOcupacao >= 80 ? 'Alta produtividade' : data.resumo.taxaOcupacao >= 50 ? 'Produtividade moderada' : 'Baixa ocupacao'}
                icon={TrendingUp}
                color={data.resumo.taxaOcupacao >= 80 ? 'text-green-600' : data.resumo.taxaOcupacao >= 50 ? 'text-yellow-600' : 'text-red-600'} />
              <KpiCard label="Chamados Trabalhados" value={data.resumo.chamadosTrabalhados}
                sub={`Tempo medio: ${data.resumo.tempoMedioPorChamadoFormatado}`}
                icon={Ticket} color="text-orange-600" />
              <KpiCard label="Atividades Projetos" value={data.resumo.atividadesTrabalhadas}
                sub={formatMin(data.resumo.totalMinutosAtividades)}
                icon={FolderKanban} color="text-purple-600" />
              <KpiCard label="Tempo Ocioso" value={formatMin(data.resumo.tempoOciosoMinutos)}
                sub={`${data.resumo.totalGaps} intervalo(s) > 15min`}
                icon={Coffee} color="text-slate-500" />
              <KpiCard label="Sobreposicoes" value={data.resumo.totalSobreposicoes}
                sub={data.resumo.totalSobreposicoes > 0 ? 'Multitasking detectado' : 'Sem sobreposicoes'}
                icon={Layers}
                color={data.resumo.totalSobreposicoes > 0 ? 'text-amber-600' : 'text-green-600'} />
            </div>

            {/* Distribuição */}
            {distTotal > 0 && (
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <h3 className="text-sm font-semibold text-slate-700 mb-3">Distribuicao do Tempo</h3>
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <div className="flex h-6 rounded-full overflow-hidden bg-slate-100">
                      {pctChamados > 0 && (
                        <div className="bg-orange-500 flex items-center justify-center text-xs text-white font-medium transition-all"
                          style={{ width: `${pctChamados}%` }}>
                          {pctChamados > 10 && `${pctChamados}%`}
                        </div>
                      )}
                      {pctAtividades > 0 && (
                        <div className="bg-purple-500 flex items-center justify-center text-xs text-white font-medium transition-all"
                          style={{ width: `${pctAtividades}%` }}>
                          {pctAtividades > 10 && `${pctAtividades}%`}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-4 text-xs">
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-orange-500" /> Chamados ({formatMin(distChamados)})</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-purple-500" /> Atividades ({formatMin(distAtividades)})</span>
                  </div>
                </div>
              </div>
            )}

            {/* Timeline — MULTI-DAY: um bloco por dia */}
            {isMultiDay && data.timeline.length > 0 && (
              <div className="space-y-4">
                {Array.from(timelineByDate.entries()).map(([dateKey, dayItems]) => {
                  const dayGaps = gapsByDate.get(dateKey) || [];
                  const dayMin = dayItems.reduce((s: number, i: TimelineItem) => s + (i.duracaoMinutos ?? 0), 0);
                  return (
                    <div key={dateKey} className="bg-white rounded-xl border border-slate-200 p-4 overflow-x-auto">
                      <div className="flex items-center gap-2 mb-3">
                        <Calendar className="w-4 h-4 text-capul-600" />
                        <h3 className="text-sm font-semibold text-slate-700">
                          {formatData(dateKey + 'T12:00:00')}
                        </h3>
                        <span className="text-xs text-slate-400 ml-2">{formatMin(dayMin)} trabalhadas</span>
                      </div>
                      <DayTimeline
                        items={dayItems}
                        gaps={dayGaps}
                        horarioIni={horarioIni}
                        horarioFim={horarioFim}
                        totalHoras={totalHoras}
                        horas={horas}
                        horario={data.horario}
                        setHoveredItem={setHoveredItem}
                      />
                    </div>
                  );
                })}

                {/* Visão Consolidada do Período */}
                <div className="bg-white rounded-xl border border-slate-200 p-4 overflow-x-auto">
                  <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                    <BarChart3 className="w-4 h-4" />
                    Visao Consolidada do Periodo
                  </h3>
                  <div className="min-w-[800px]">
                    {/* Header de horas */}
                    <div className="flex border-b border-slate-200 pb-1 mb-1">
                      <div className="w-52 flex-shrink-0" />
                      <div className="flex-1 relative h-4">
                        {horas.map((h) => (
                          <div
                            key={h}
                            className="absolute text-[10px] text-slate-400 font-medium"
                            style={{ left: `${((h - horarioIni) / totalHoras) * 100}%` }}
                          >
                            {String(h).padStart(2, '0')}:00
                          </div>
                        ))}
                      </div>
                    </div>
                    {/* Uma linha por dia */}
                    {Array.from(timelineByDate.entries()).map(([dateKey, dayItems]) => (
                      <DaySummaryBar
                        key={dateKey}
                        dateKey={dateKey}
                        items={dayItems}
                        horarioIni={horarioIni}
                        horarioFim={horarioFim}
                        totalHoras={totalHoras}
                        horas={horas}
                        horario={data.horario}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Timeline — SINGLE DAY: layout original */}
            {!isMultiDay && data.timeline.length > 0 && (
              <div className="bg-white rounded-xl border border-slate-200 p-4 overflow-x-auto">
                <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4" />
                  Timeline
                </h3>
                <DayTimeline
                  items={data.timeline}
                  gaps={data.gaps}
                  horarioIni={horarioIni}
                  horarioFim={horarioFim}
                  totalHoras={totalHoras}
                  horas={horas}
                  horario={data.horario}
                  setHoveredItem={setHoveredItem}
                />
              </div>
            )}

            {/* Tooltip flutuante */}
            {hoveredItem && (
              <div className="fixed bottom-6 right-6 bg-slate-800 text-white rounded-lg p-3 shadow-xl z-50 max-w-xs text-xs space-y-1">
                <p className="font-semibold">{hoveredItem.titulo}</p>
                <p>{formatData(hoveredItem.horaInicio)} {formatHora(hoveredItem.horaInicio)} — {hoveredItem.horaFim ? formatHora(hoveredItem.horaFim) : 'em andamento'}</p>
                {hoveredItem.duracaoMinutos && <p>Duracao: {formatMin(hoveredItem.duracaoMinutos)}</p>}
                {hoveredItem.observacoes && <p className="text-slate-300">{hoveredItem.observacoes}</p>}
                {hoveredItem.tipo === 'chamado' && hoveredItem.detalhes.prioridade ? (
                  <p>Prioridade: {String(hoveredItem.detalhes.prioridade)}</p>
                ) : null}
                {hoveredItem.tipo === 'atividade' && hoveredItem.detalhes.projetoNome ? (
                  <p>Projeto: {String(hoveredItem.detalhes.projetoNome)}</p>
                ) : null}
                <p className="text-slate-400">Tecnico: {hoveredItem.usuarioNome}</p>
              </div>
            )}

            {/* Heatmap */}
            {distribuicaoPorHora.length > 0 && (
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                  <Zap className="w-4 h-4" />
                  Intensidade por Hora {isMultiDay && '(Acumulado do Periodo)'}
                </h3>
                <div className="flex gap-1 items-end" style={{ height: 100 }}>
                  {distribuicaoPorHora.map((h) => {
                    const maxMin = Math.max(...distribuicaoPorHora.map((x) => x.minutos), 1);
                    const pct = (h.minutos / maxMin) * 100;
                    return (
                      <div key={h.hora} className="flex-1 flex flex-col items-center gap-1">
                        <div className="w-full flex items-end" style={{ height: 80 }}>
                          <div
                            className={`w-full rounded-t transition-all ${h.minutos > 0 ? 'bg-capul-500' : 'bg-slate-100'}`}
                            style={{ height: `${Math.max(pct, 2)}%` }}
                            title={`${String(h.hora).padStart(2, '0')}:00 — ${h.minutos}min`}
                          />
                        </div>
                        <span className="text-[10px] text-slate-400">{String(h.hora).padStart(2, '0')}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Sobreposições */}
            {data.sobreposicoes.length > 0 && (
              <div className="bg-amber-50 rounded-xl border border-amber-200 p-4">
                <h3 className="text-sm font-semibold text-amber-800 mb-3 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  Sobreposicoes Detectadas (Multitasking)
                </h3>
                <div className="space-y-2">
                  {data.sobreposicoes.map((s, i) => (
                    <div key={i} className="flex items-center gap-3 text-xs text-amber-700 bg-amber-100/50 rounded-lg p-2">
                      <Layers className="w-3.5 h-3.5 flex-shrink-0" />
                      <div className="flex-1">
                        <span className="font-medium">{s.item1}</span>
                        <span className="text-amber-500 mx-1">&amp;</span>
                        <span className="font-medium">{s.item2}</span>
                      </div>
                      <span className="text-amber-600 whitespace-nowrap">
                        {formatData(s.inicio)} {formatHora(s.inicio)}–{formatHora(s.fim)} ({formatMin(s.duracaoMinutos)})
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Ranking de técnicos */}
            {!tecnicoId && data.porUsuario.length > 1 && (
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Ranking por Tecnico
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-slate-500 border-b border-slate-200">
                        <th className="text-left py-2 font-medium">Tecnico</th>
                        <th className="text-right py-2 font-medium">Chamados</th>
                        <th className="text-right py-2 font-medium">Atividades</th>
                        <th className="text-right py-2 font-medium">Total</th>
                        <th className="text-right py-2 font-medium">Registros</th>
                        <th className="text-left py-2 font-medium pl-4">Ocupacao</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.porUsuario.map((u) => {
                        const ocp = data.resumo.horasDisponiveis > 0
                          ? Math.min(100, Math.round((u.totalMinutos / (data.resumo.horasDisponiveis * 60)) * 100))
                          : 0;
                        return (
                          <tr key={u.usuarioId} className="border-b border-slate-50 hover:bg-slate-50">
                            <td className="py-2 font-medium text-slate-700">{u.nome}</td>
                            <td className="py-2 text-right text-orange-600">{formatMin(u.minutosChamados)}</td>
                            <td className="py-2 text-right text-purple-600">{formatMin(u.minutosAtividades)}</td>
                            <td className="py-2 text-right font-semibold">{fmtHoras(u.totalHoras)}</td>
                            <td className="py-2 text-right text-slate-500">{u.totalRegistros}</td>
                            <td className="py-2 pl-4">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-2 bg-slate-100 rounded-full max-w-[80px]">
                                  <div className={`h-2 rounded-full ${ocp >= 80 ? 'bg-green-500' : ocp >= 50 ? 'bg-yellow-500' : 'bg-red-400'}`}
                                    style={{ width: `${ocp}%` }} />
                                </div>
                                <span className="text-xs text-slate-500">{ocp}%</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Detalhamento */}
            {data.timeline.length > 0 && (
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <h3 className="text-sm font-semibold text-slate-700 mb-3">Detalhamento</h3>
                <div className="space-y-1 max-h-96 overflow-y-auto">
                  {data.timeline.map((item) => (
                    <div key={item.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 text-xs">
                      {item.tipo === 'chamado' ? (
                        <span className="w-2 h-2 rounded-full bg-orange-500 flex-shrink-0" />
                      ) : (
                        <span className="w-2 h-2 rounded-full bg-purple-500 flex-shrink-0" />
                      )}
                      {isMultiDay && (
                        <span className="text-slate-300 w-12 flex-shrink-0">{formatDataCurta(item.horaInicio)}</span>
                      )}
                      <span className="text-slate-400 w-24 flex-shrink-0">
                        {formatHora(item.horaInicio)} — {item.horaFim ? formatHora(item.horaFim) : '...'}
                      </span>
                      <span className="text-slate-700 flex-1 truncate">{item.titulo}</span>
                      <span className="text-slate-400 w-14 text-right flex-shrink-0">
                        {item.duracaoMinutos ? formatMin(item.duracaoMinutos) : 'ativo'}
                      </span>
                      {item.tipo === 'chamado' && item.referencia && (
                        <>
                          <a href={`/gestao-ti/chamados/${item.referencia}`}
                            target="_blank" rel="noopener noreferrer"
                            className="text-capul-600 hover:text-capul-800 flex-shrink-0">Ver</a>
                          <a href={`/gestao-ti/acompanhamento-item?tipo=chamado&id=${item.referencia}`}
                            target="_blank" rel="noopener noreferrer"
                            className="text-orange-500 hover:text-orange-700 flex-shrink-0">Acompanhar</a>
                        </>
                      )}
                      {item.tipo === 'atividade' && item.detalhes.projetoId ? (
                        <>
                          <a href={`/gestao-ti/projetos/${String(item.detalhes.projetoId)}`}
                            target="_blank" rel="noopener noreferrer"
                            className="text-capul-600 hover:text-capul-800 flex-shrink-0">Ver</a>
                          <a href={`/gestao-ti/acompanhamento-item?tipo=atividade&id=${item.referencia}`}
                            target="_blank" rel="noopener noreferrer"
                            className="text-purple-500 hover:text-purple-700 flex-shrink-0">Acompanhar</a>
                        </>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button onClick={() => { setData(null); setTecnicoId(''); setDataInicio(hoje()); setDataFim(hoje()); }}
              className="text-sm text-capul-600 hover:text-capul-800">
              ← Voltar para selecao
            </button>
          </>
        )}

        {!loading && data && data.timeline.length === 0 && (
          <div className="text-center py-12 text-slate-400">
            <Clock className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p className="text-lg font-medium text-slate-500">Nenhum registro encontrado</p>
            <p className="text-sm">Selecione um tecnico ou ajuste o periodo para visualizar a timeline.</p>
          </div>
        )}
      </main>
    </>
  );
}
