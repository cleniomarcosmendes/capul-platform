import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Car, CircleDot, Loader2, MapPin, RefreshCw, TrendingUp, Wrench } from 'lucide-react';
import { logisticaApi } from '../services/api';
import { useToast } from '../components/Toast';

// Painel tempo real da frota (monitoramento com recorte interno). "Tempo real"
// via polling (auto-refresh 30s) — sem websocket. Padrão workspace.

interface PainelFrota {
  veiculos: { disponivel: number; emUso: number; manutencao: number; baixado: number; total: number };
  emCurso: { id: string; numero: number; placa: string; modelo?: string | null; condutorNome?: string | null; dataHoraSaida?: string | null; finalidade?: string | null; kmInicial?: number | null; paradas: number }[];
  alertas: { veiculosManutencao: string[]; despesasPendentes: number };
  indicadores: {
    custoTotalMes: number; kmRodadoMes: number; custoPorKm: number | null;
    rankingVeiculo: { placa: string; km: number }[];
    rankingDepartamento: { departamento: string; viagens: number }[];
  };
}

const REFRESH_MS = 30_000;
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
  const { toast } = useToast();
  const [data, setData] = useState<PainelFrota | null>(null);
  const [loading, setLoading] = useState(true);
  const [atualizadoEm, setAtualizadoEm] = useState<Date | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

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

      {/* Cartões de situação da frota */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <CardSituacao label="Disponíveis" valor={veiculos.disponivel} cls="text-emerald-600" />
        <CardSituacao label="Em uso" valor={veiculos.emUso} cls="text-sky-600" />
        <CardSituacao label="Em manutenção" valor={veiculos.manutencao} cls="text-amber-600" />
        <CardSituacao label="Frota total" valor={veiculos.total} cls="text-slate-700" icon={<Car className="h-4 w-4" />} />
      </div>

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
                <li key={v.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <div className="font-medium text-slate-800">{v.placa}{v.modelo ? <span className="text-slate-400"> · {v.modelo}</span> : null}</div>
                    <div className="text-xs text-slate-500">{v.condutorNome ?? '—'}{v.finalidade ? ` — ${v.finalidade}` : ''}</div>
                  </div>
                  <div className="text-right text-xs text-slate-500">
                    <div>{fmtHora(v.dataHoraSaida)} <span className="text-slate-400">{desde(v.dataHoraSaida)}</span></div>
                    {v.paradas > 0 && <div className="inline-flex items-center gap-1 text-slate-400"><MapPin className="h-3 w-3" /> {v.paradas} parada(s)</div>}
                  </div>
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

function CardSituacao({ label, valor, cls, icon }: { label: string; valor: number; cls: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-slate-400">{icon}{label}</div>
      <div className={`mt-1 text-3xl font-semibold ${cls}`}>{valor}</div>
    </div>
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
