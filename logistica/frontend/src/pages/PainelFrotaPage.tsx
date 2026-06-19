import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Car, ChevronRight, CircleDot, Loader2, MapPin, RefreshCw, TrendingUp, Wrench, X } from 'lucide-react';
import { logisticaApi } from '../services/api';
import { useToast } from '../components/Toast';
import { MapaFrota } from '../components/MapaFrota';

// Painel tempo real da frota (monitoramento com recorte interno). "Tempo real"
// via polling (auto-refresh 30s) — sem websocket. Padrão workspace.

interface PainelFrota {
  veiculos: { disponivel: number; emUso: number; manutencao: number; baixado: number; total: number };
  emCurso: { id: string; numero: number; tipo: 'ENTREGA' | 'FROTA'; placa: string; modelo?: string | null; condutorNome?: string | null; dataHoraSaida?: string | null; finalidade?: string | null; kmInicial?: number | null; paradas: number }[];
  alertas: {
    veiculosManutencao: string[];
    manutencaoPreventiva: { id: string; placa: string; modelo?: string | null; kmAtual: number; kmProxima: number; faltam: number; vencida: boolean }[];
    despesasPendentes: number;
  };
  indicadores: {
    custoTotalMes: number; kmRodadoMes: number; custoPorKm: number | null;
    rankingVeiculo: { placa: string; km: number }[];
    rankingDepartamento: { departamento: string; viagens: number }[];
  };
}

interface VeiculoLinha {
  id: string; placa: string; modelo?: string | null; marca?: string | null;
  tipo: string; situacao: string; kmAtual: number; supervisorNome?: string | null;
}

const REFRESH_MS = 30_000;
const SIT_VEIC: Record<string, { label: string; cls: string }> = {
  DISPONIVEL: { label: 'Disponível', cls: 'bg-emerald-100 text-emerald-700' },
  EM_USO: { label: 'Em uso', cls: 'bg-sky-100 text-sky-700' },
  EM_MANUTENCAO: { label: 'Manutenção', cls: 'bg-amber-100 text-amber-700' },
  BAIXADO: { label: 'Baixado', cls: 'bg-slate-200 text-slate-600' },
};
const BRL = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtHora = (s?: string | null) => (s ? new Date(s).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—');
const desde = (s?: string | null) => {
  if (!s) return '';
  const min = Math.floor((Date.now() - new Date(s).getTime()) / 60000);
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  return `há ${h}h${String(min % 60).padStart(2, '0')}`;
};

export function PainelFrotaPage() {
  const { toast, confirm } = useToast();
  const navigate = useNavigate();
  const [data, setData] = useState<PainelFrota | null>(null);
  const [loading, setLoading] = useState(true);
  const [atualizadoEm, setAtualizadoEm] = useState<Date | null>(null);
  const [busyManut, setBusyManut] = useState<string | null>(null);
  // Drill-down dos cards de situação: clicar mostra QUAIS veículos (busca sob
  // demanda em /veiculos, não infla o polling de 30s).
  const [drill, setDrill] = useState<{ situacao: string; label: string } | null>(null);
  const [drillVeiculos, setDrillVeiculos] = useState<VeiculoLinha[]>([]);
  const [drillLoading, setDrillLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Abre/fecha o detalhe de um card. situacao '' = frota toda.
  const abrirDrill = useCallback(async (situacao: string, label: string) => {
    if (drill?.situacao === situacao) { setDrill(null); return; } // toggle fecha
    setDrill({ situacao, label });
    setDrillLoading(true);
    try {
      const { data } = await logisticaApi.get<VeiculoLinha[]>('/veiculos', {
        params: situacao ? { situacao } : undefined,
      });
      setDrillVeiculos(data);
    } catch {
      setDrillVeiculos([]);
    } finally {
      setDrillLoading(false);
    }
  }, [drill]);

  const carregar = useCallback(async (silencioso = false) => {
    if (!silencioso) setLoading(true);
    try {
      const { data } = await logisticaApi.get<PainelFrota>('/frota/painel');
      setData(data);
      setAtualizadoEm(new Date());
    } catch (e) {
      if (!silencioso) {
        const m = (e as { response?: { data?: { message?: unknown } } })?.response?.data?.message;
        toast('error', Array.isArray(m) ? m.join(', ') : (typeof m === 'string' ? m : 'Falha ao carregar o painel.'));
      }
    } finally {
      if (!silencioso) setLoading(false);
    }
  }, [toast]);

  const registrarManutencao = async (veiculoId: string, placa: string) => {
    const ok = await confirm(
      'Registrar manutenção',
      `Confirmar manutenção do veículo ${placa}? A próxima revisão será reagendada (km atual + intervalo).`,
      { confirmLabel: 'Registrar', variant: 'default' },
    );
    if (!ok) return;
    setBusyManut(veiculoId);
    try {
      await logisticaApi.post(`/frota/veiculos/${veiculoId}/manutencao`, {});
      toast('success', `Manutenção do ${placa} registrada.`);
      await carregar(true);
    } catch (e) {
      const m = (e as { response?: { data?: { message?: unknown } } })?.response?.data?.message;
      toast('error', Array.isArray(m) ? m.join(', ') : (typeof m === 'string' ? m : 'Falha ao registrar manutenção.'));
    } finally {
      setBusyManut(null);
    }
  };

  useEffect(() => {
    void carregar();
    timer.current = setInterval(() => void carregar(true), REFRESH_MS);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [carregar]);

  if (loading && !data) {
    return <div className="flex items-center justify-center gap-2 py-20 text-slate-400"><Loader2 className="h-5 w-5 animate-spin" /> Carregando painel…</div>;
  }
  if (!data) return null;

  const { veiculos, emCurso, alertas, indicadores } = data;
  // Cruza veículo em uso → viagem em curso (por placa) p/ mostrar destino/condutor no drill.
  const emCursoPorPlaca = new Map(emCurso.map((c) => [c.placa, c]));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CircleDot className="h-6 w-6 text-sky-600" />
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Monitor da Frota</h2>
            <p className="text-sm text-slate-500">Situação da frota agora · atualiza sozinho a cada 30s.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          {atualizadoEm && <span>atualizado {atualizadoEm.toLocaleTimeString('pt-BR')}</span>}
          <button onClick={() => void carregar()} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2 py-1 text-slate-600 hover:bg-slate-50">
            <RefreshCw className="h-3.5 w-3.5" /> Atualizar
          </button>
        </div>
      </div>

      {/* Cartões de situação da frota — clicáveis (drill-down por veículo) */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <CardSituacao label="Disponíveis" valor={veiculos.disponivel} cls="text-emerald-600" active={drill?.situacao === 'DISPONIVEL'} onClick={() => void abrirDrill('DISPONIVEL', 'Disponíveis')} />
        <CardSituacao label="Em uso" valor={veiculos.emUso} cls="text-sky-600" active={drill?.situacao === 'EM_USO'} onClick={() => void abrirDrill('EM_USO', 'Em uso')} />
        <CardSituacao label="Em manutenção" valor={veiculos.manutencao} cls="text-amber-600" active={drill?.situacao === 'EM_MANUTENCAO'} onClick={() => void abrirDrill('EM_MANUTENCAO', 'Em manutenção')} />
        <CardSituacao label="Frota total" valor={veiculos.total} cls="text-slate-700" icon={<Car className="h-4 w-4" />} active={drill?.situacao === ''} onClick={() => void abrirDrill('', 'Frota total')} />
      </div>

      {/* Drill-down: veículos da situação clicada */}
      {drill && (
        <div className="rounded-xl border border-sky-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
            <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <Car className="h-4 w-4 text-sky-500" /> {drill.label}
              {!drillLoading && <span className="text-xs font-normal text-slate-400">({drillVeiculos.length})</span>}
            </span>
            <button onClick={() => setDrill(null)} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600" title="Fechar"><X className="h-4 w-4" /></button>
          </div>
          {drillLoading ? (
            <div className="flex items-center gap-2 px-4 py-6 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> Carregando…</div>
          ) : drillVeiculos.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-slate-400">Nenhum veículo nesta situação.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-2">Placa</th>
                  <th className="px-4 py-2">Modelo</th>
                  {drill.situacao === 'EM_USO' ? (
                    <>
                      <th className="px-4 py-2">Condutor</th>
                      <th className="px-4 py-2">Destino / finalidade</th>
                    </>
                  ) : (
                    <th className="px-4 py-2">Supervisor</th>
                  )}
                  <th className="px-4 py-2 text-right">KM atual</th>
                  {drill.situacao === '' && <th className="px-4 py-2">Situação</th>}
                  {drill.situacao === 'EM_USO' && <th className="px-4 py-2"></th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {drillVeiculos.map((v) => {
                  const sm = SIT_VEIC[v.situacao] ?? { label: v.situacao, cls: 'bg-slate-100 text-slate-600' };
                  const c = emCursoPorPlaca.get(v.placa); // viagem em curso deste veículo
                  const clicavel = drill.situacao === 'EM_USO' && !!c;
                  return (
                    <tr
                      key={v.id}
                      onClick={clicavel ? () => navigate(`/frota/viagens/${c!.id}`) : undefined}
                      className={`hover:bg-slate-50 ${clicavel ? 'cursor-pointer hover:bg-sky-50/60' : ''}`}
                      title={clicavel ? 'Abrir viagem' : undefined}
                    >
                      <td className="px-4 py-2 font-medium text-slate-800">{v.placa}</td>
                      <td className="px-4 py-2 text-slate-600">{[v.marca, v.modelo].filter(Boolean).join(' ') || '—'}</td>
                      {drill.situacao === 'EM_USO' ? (
                        <>
                          <td className="px-4 py-2 text-slate-600">{c?.condutorNome ?? '—'}</td>
                          <td className="px-4 py-2 text-slate-600">{c?.finalidade ?? '—'}</td>
                        </>
                      ) : (
                        <td className="px-4 py-2 text-slate-600">{v.supervisorNome ?? '—'}</td>
                      )}
                      <td className="px-4 py-2 text-right tabular-nums text-slate-600">{v.kmAtual.toLocaleString('pt-BR')}</td>
                      {drill.situacao === '' && <td className="px-4 py-2"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${sm.cls}`}>{sm.label}</span></td>}
                      {drill.situacao === 'EM_USO' && <td className="px-4 py-2 text-right">{clicavel && <ChevronRight className="ml-auto h-4 w-4 text-slate-300" />}</td>}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Alertas */}
      {(alertas.veiculosManutencao.length > 0 || alertas.despesasPendentes > 0) && (
        <div className="flex flex-wrap gap-3">
          {alertas.despesasPendentes > 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              <AlertTriangle className="h-4 w-4" /> {alertas.despesasPendentes} despesa(s) pendente(s) de validação
            </div>
          )}
          {alertas.veiculosManutencao.length > 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              <Wrench className="h-4 w-4" /> Em manutenção: {alertas.veiculosManutencao.join(', ')}
            </div>
          )}
        </div>
      )}

      {/* Manutenção preventiva por KM */}
      {alertas.manutencaoPreventiva.length > 0 && (
        <div className="rounded-xl border border-orange-200 bg-orange-50/70 p-4">
          <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-orange-800">
            <Wrench className="h-4 w-4" /> Revisão preventiva ({alertas.manutencaoPreventiva.length})
          </p>
          <div className="space-y-1.5">
            {alertas.manutencaoPreventiva.map((m) => (
              <div key={m.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                <span className="font-medium text-slate-800">{m.placa}{m.modelo ? <span className="font-normal text-slate-400"> · {m.modelo}</span> : null}</span>
                <span className="tabular-nums text-slate-600">{m.kmAtual.toLocaleString('pt-BR')} / {m.kmProxima.toLocaleString('pt-BR')} km</span>
                {m.vencida ? (
                  <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-700">vencida há {Math.abs(m.faltam).toLocaleString('pt-BR')} km</span>
                ) : (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">faltam {m.faltam.toLocaleString('pt-BR')} km</span>
                )}
                <button onClick={() => void registrarManutencao(m.id, m.placa)} disabled={busyManut === m.id}
                  className="ml-auto inline-flex items-center gap-1 rounded-lg border border-orange-300 bg-white px-2 py-1 text-xs text-orange-700 hover:bg-orange-100 disabled:opacity-50">
                  {busyManut === m.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wrench className="h-3 w-3" />} Registrar manutenção
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Mapa ao vivo das viagens em curso (rastreamento Fase A) */}
      <MapaFrota />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Na rua agora */}
        <div className="rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-700">
            Na rua agora ({emCurso.length})
          </div>
          {emCurso.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-400">Nenhum veículo em viagem.</div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {emCurso.map((v) => (
                <li key={v.id}>
                  <button
                    type="button"
                    onClick={() => navigate(v.tipo === 'FROTA' ? `/frota/viagens/${v.id}` : `/viagens/${v.id}`)}
                    className="group flex w-full items-center justify-between gap-2 px-4 py-3 text-left transition hover:bg-sky-50/60"
                    title="Abrir viagem"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${v.tipo === 'FROTA' ? 'bg-green-100 text-green-700' : 'bg-sky-100 text-sky-700'}`}>
                          {v.tipo === 'FROTA' ? 'Frota' : 'Entrega'}
                        </span>
                        <span className="font-medium text-slate-800">{v.placa}{v.modelo ? <span className="text-slate-400"> · {v.modelo}</span> : null}</span>
                      </div>
                      <div className="truncate text-xs text-slate-500">{v.condutorNome ?? '—'}{v.finalidade ? ` — ${v.finalidade}` : ''}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right text-xs text-slate-500">
                        <div>{fmtHora(v.dataHoraSaida)} <span className="text-slate-400">{desde(v.dataHoraSaida)}</span></div>
                        {v.paradas > 0 && <div className="inline-flex items-center gap-1 text-slate-400"><MapPin className="h-3 w-3" /> {v.paradas} parada(s)</div>}
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:text-sky-500" />
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Indicadores do mês */}
        <div className="rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-700">
            <TrendingUp className="h-4 w-4 text-slate-400" /> Indicadores do mês
          </div>
          <div className="grid grid-cols-3 gap-3 p-4">
            <Mini label="Custo total" valor={BRL(indicadores.custoTotalMes)} />
            <Mini label="KM rodado" valor={`${indicadores.kmRodadoMes.toLocaleString('pt-BR')} km`} />
            <Mini label="Custo por km" valor={indicadores.custoPorKm != null ? BRL(indicadores.custoPorKm) : '—'} />
          </div>
          <div className="grid grid-cols-1 gap-4 px-4 pb-4 sm:grid-cols-2">
            <RankingBox titulo="Uso por veículo (km)" itens={indicadores.rankingVeiculo.map((r) => ({ nome: r.placa, val: `${r.km.toLocaleString('pt-BR')} km` }))} />
            <RankingBox titulo="Uso por departamento" itens={indicadores.rankingDepartamento.map((r) => ({ nome: r.departamento, val: `${r.viagens} viagem(ns)` }))} />
          </div>
        </div>
      </div>
    </div>
  );
}

function CardSituacao({ label, valor, cls, icon, active, onClick }: { label: string; valor: number; cls: string; icon?: React.ReactNode; active?: boolean; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border bg-white p-4 text-left transition hover:border-sky-300 hover:shadow-sm ${active ? 'border-sky-400 ring-1 ring-sky-300' : 'border-slate-200'}`}
    >
      <div className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-slate-400">{icon}{label}</div>
      <div className={`mt-1 text-3xl font-semibold ${cls}`}>{valor}</div>
      <div className="mt-0.5 text-[11px] text-slate-400">{active ? 'clique p/ fechar' : 'ver veículos'}</div>
    </button>
  );
}

function Mini({ label, valor }: { label: string; valor: string }) {
  return (
    <div>
      <p className="text-xs text-slate-400">{label}</p>
      <p className="mt-0.5 text-lg font-semibold text-slate-800">{valor}</p>
    </div>
  );
}

function RankingBox({ titulo, itens }: { titulo: string; itens: { nome: string; val: string }[] }) {
  return (
    <div>
      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">{titulo}</p>
      <ul className="space-y-1 text-sm">
        {itens.length === 0 ? <li className="text-slate-400">—</li> : itens.map((i, idx) => (
          <li key={idx} className="flex justify-between"><span className="text-slate-600">{i.nome}</span><span className="tabular-nums text-slate-800">{i.val}</span></li>
        ))}
      </ul>
    </div>
  );
}
