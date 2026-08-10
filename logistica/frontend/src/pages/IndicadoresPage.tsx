import { useEffect, useState } from 'react';
import {
  Loader2, ChevronLeft, ChevronRight, DollarSign, Boxes, Receipt, RefreshCw, MapPin, Gauge,
} from 'lucide-react';
import { coreApi, logisticaApi } from '../services/api';

// Indicadores analíticos por MÊS (separados do Painel operacional em 12/06 —
// o Painel ficou denso demais). Valor por canal, performance por motorista,
// demanda por bairro e re-entregas. Read-only (GET /painel/indicadores).

interface CoreItem { id: string; nome?: string; codigo?: string; nomeFantasia?: string }
interface OrigemInd { origem: string; entregas: number; volumes: number; valor: number; ticketMedio: number }
interface MotoristaInd { motoristaId: string; nomeMotorista?: string | null; total: number; entregues: number; naoEntregues: number; volumes: number; taxaSucesso: number | null }
interface DemandaInd { cidade: string | null; bairro: string; total: number }
interface KmVeiculoInd { placa: string; km: number }
interface KmMotoristaInd { motoristaId: string; nomeMotorista?: string | null; km: number }
interface KmInd { total: number; viagens: number; porEntrega: number | null; porVeiculo: KmVeiculoInd[]; porMotorista: KmMotoristaInd[] }
interface Indicadores {
  filtros: { filialId: string | null; mes: number; ano: number };
  totais: { entregas: number; volumes: number; valorTotal: number; ticketMedio: number; reentregas: number; taxaReentrega: number };
  km: KmInd;
  porOrigem: OrigemInd[];
  porMotorista: MotoristaInd[];
  demanda: DemandaInd[];
}

const fmtKm = (v: number) => `${v.toLocaleString('pt-BR')} km`;

const labelCore = (i?: CoreItem) => (i ? i.nomeFantasia || i.nome || i.codigo || i.id.slice(0, 8) : '—');
const ORIGEM_LABEL: Record<string, string> = { PRESENCIAL: 'Presencial', TELE_VENDA: 'Tele-venda', OUTRO: 'Outro', NAO_INFORMADO: 'Não informado' };
const ORIGEM_COR: Record<string, string> = { PRESENCIAL: '#10b981', TELE_VENDA: '#0ea5e9', OUTRO: '#f59e0b', NAO_INFORMADO: '#94a3b8' };
const corOrigem = (o: string) => ORIGEM_COR[o] ?? '#94a3b8';
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtPct = (v: number | null | undefined) => (v == null ? '—' : `${Math.round(v * 100)}%`);

export function IndicadoresPage() {
  const [filiais, setFiliais] = useState<CoreItem[]>([]);
  const [usuarios, setUsuarios] = useState<CoreItem[]>([]);
  const [filialId, setFilialId] = useState('');

  const agora = new Date();
  const [mes, setMes] = useState(agora.getMonth() + 1);
  const [ano, setAno] = useState(agora.getFullYear());
  const [ind, setInd] = useState<Indicadores | null>(null);
  const [loading, setLoading] = useState(true);

  const noMesAtual = ano === agora.getFullYear() && mes === agora.getMonth() + 1;
  const passoMes = (delta: number) => {
    const d = new Date(ano, mes - 1 + delta, 1);
    setMes(d.getMonth() + 1);
    setAno(d.getFullYear());
  };

  useEffect(() => {
    void (async () => {
      const [f, u] = await Promise.all([
        coreApi.get<CoreItem[]>('/filiais').catch(() => ({ data: [] })),
        coreApi.get<CoreItem[]>('/usuarios').catch(() => ({ data: [] })),
      ]);
      setFiliais(f.data); setUsuarios(u.data);
    })();
  }, []);

  useEffect(() => {
    setLoading(true);
    logisticaApi
      .get<Indicadores>('/painel/indicadores', { params: { ...(filialId ? { filialId } : {}), mes, ano } })
      .then((r) => setInd(r.data))
      .finally(() => setLoading(false));
  }, [filialId, mes, ano]);

  const nomeUsuario = (id: string) => labelCore(usuarios.find((x) => x.id === id));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Indicadores de Entrega</h2>
          <p className="text-sm text-slate-500">Valor por canal, performance por motorista, demanda e re-entregas — por mês.</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={filialId} onChange={(e) => setFilialId(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-capul-500 focus:outline-none">
            <option value="">Todas as filiais</option>
            {filiais.map((f) => <option key={f.id} value={f.id}>{labelCore(f)}</option>)}
          </select>
          <div className="flex items-center gap-1 rounded-lg border border-slate-300 bg-white p-1">
            <button onClick={() => passoMes(-1)} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100" title="Mês anterior">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="min-w-[130px] text-center text-sm font-medium text-slate-700">{MESES[mes - 1]} {ano}</span>
            <button onClick={() => passoMes(1)} disabled={noMesAtual}
              className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-30" title="Próximo mês">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {loading || !ind ? (
        <div className="flex items-center gap-2 p-6 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Carregando indicadores…</div>
      ) : ind.totais.entregas === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-400">
          Nenhuma entrega em {MESES[mes - 1]} {ano}{filialId ? ' nesta filial' : ''}.
        </div>
      ) : (
        <>
          {/* KPIs do mês */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTexto icon={DollarSign} cor="text-emerald-600" bg="bg-emerald-50" valor={fmtBRL(ind.totais.valorTotal)} rotulo="Valor no mês" sub={`${ind.totais.entregas} entregas`} />
            <Stat icon={Boxes} cor="text-capul-600" bg="bg-capul-50" valor={ind.totais.volumes} rotulo="Volumes transportados" />
            <StatTexto icon={Receipt} cor="text-indigo-600" bg="bg-indigo-50" valor={fmtBRL(ind.totais.ticketMedio)} rotulo="Ticket médio" sub="valor ÷ entregas" />
            <Stat icon={RefreshCw} cor="text-amber-600" bg="bg-amber-50" valor={ind.totais.reentregas} rotulo="Re-entregas (2ª tentativa)" sub={`${fmtPct(ind.totais.taxaReentrega)} do total`} />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Valor por tipo de venda */}
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-700">Valor por tipo de venda</div>
              {ind.porOrigem.length === 0 ? <Vazio /> : (
                <>
                  <DonutOrigem itens={ind.porOrigem} total={ind.totais.valorTotal} />
                  <ul className="divide-y divide-slate-100 border-t border-slate-100">
                    {ind.porOrigem.map((o) => {
                      const pct = ind.totais.valorTotal > 0 ? (o.valor / ind.totais.valorTotal) * 100 : 0;
                      return (
                        <li key={o.origem} className="px-4 py-2.5">
                          <div className="flex items-center justify-between text-sm">
                            <span className="flex items-center gap-2 text-slate-700">
                              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: corOrigem(o.origem) }} />
                              {ORIGEM_LABEL[o.origem] ?? o.origem}
                            </span>
                            <span className="font-semibold text-slate-800">{fmtBRL(o.valor)}</span>
                          </div>
                          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                            <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: corOrigem(o.origem) }} />
                          </div>
                          <div className="mt-1 text-xs text-slate-400">{o.entregas} entregas · {o.volumes} vol · ticket {fmtBRL(o.ticketMedio)} · {Math.round(pct)}%</div>
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
            </div>

            {/* Demanda por bairro */}
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-700">
                <MapPin className="h-4 w-4 text-rose-500" /> Demanda por bairro
              </div>
              {ind.demanda.length === 0 ? <Vazio /> : (
                <ul className="divide-y divide-slate-100">
                  {ind.demanda.map((d, i) => {
                    const max = ind.demanda[0]?.total || 1;
                    return (
                      <li key={`${d.cidade}-${d.bairro}-${i}`} className="px-4 py-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-700">{d.bairro}{d.cidade ? <span className="text-slate-400"> · {d.cidade}</span> : null}</span>
                          <span className="font-semibold text-slate-800">{d.total}</span>
                        </div>
                        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full rounded-full bg-rose-400" style={{ width: `${(d.total / max) * 100}%` }} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          {/* Performance por motorista */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-700">Performance por motorista</div>
            {ind.porMotorista.length === 0 ? <Vazio /> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                    <tr>
                      <th className="px-4 py-2.5">Motorista</th>
                      <th className="px-4 py-2.5 text-right">Entregas</th>
                      <th className="px-4 py-2.5 text-right">Entregues</th>
                      <th className="px-4 py-2.5 text-right">Não entregues</th>
                      <th className="px-4 py-2.5 text-right">Volumes</th>
                      <th className="px-4 py-2.5 text-right">Taxa de sucesso</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {ind.porMotorista.map((m) => {
                      const taxa = m.taxaSucesso;
                      const cls = taxa == null ? 'bg-slate-100 text-slate-500'
                        : taxa >= 0.95 ? 'bg-emerald-100 text-emerald-700'
                        : taxa >= 0.8 ? 'bg-amber-100 text-amber-700'
                        : 'bg-rose-100 text-rose-700';
                      return (
                        <tr key={m.motoristaId} className="hover:bg-slate-50">
                          <td className="px-4 py-2 text-slate-700">{m.nomeMotorista || nomeUsuario(m.motoristaId)}</td>
                          <td className="px-4 py-2 text-right text-slate-600">{m.total}</td>
                          <td className="px-4 py-2 text-right text-emerald-700">{m.entregues}</td>
                          <td className="px-4 py-2 text-right text-rose-600">{m.naoEntregues}</td>
                          <td className="px-4 py-2 text-right text-slate-600">{m.volumes}</td>
                          <td className="px-4 py-2 text-right">
                            <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${cls}`}>{fmtPct(taxa)}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <p className="px-4 py-2 text-xs text-slate-400">Taxa de sucesso = entregues ÷ (entregues + não entregues).</p>
          </div>

          {/* Quilometragem (hodômetro na saída/chegada) */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-700">
              <Gauge className="h-4 w-4 text-indigo-500" /> Quilometragem
            </div>
            {ind.km.viagens === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-slate-400">
                Nenhuma rota com hodômetro registrada no mês.<br />
                <span className="text-xs">O motorista informa o KM de saída e de retorno no app — é isso que alimenta este indicador.</span>
              </p>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3">
                  <StatTexto icon={Gauge} cor="text-indigo-600" bg="bg-indigo-50" valor={fmtKm(ind.km.total)} rotulo="KM rodados no mês" sub={`${ind.km.viagens} rota(s) com hodômetro`} />
                  <StatTexto icon={Boxes} cor="text-capul-600" bg="bg-capul-50" valor={ind.km.porEntrega != null ? `${ind.km.porEntrega.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km` : '—'} rotulo="KM por entrega" sub="eficiência da rota" />
                </div>
                <div className="grid grid-cols-1 gap-0 border-t border-slate-100 sm:grid-cols-2">
                  <div className="sm:border-r sm:border-slate-100">
                    <div className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Por veículo</div>
                    <ul className="divide-y divide-slate-100">
                      {ind.km.porVeiculo.map((v) => (
                        <li key={v.placa} className="flex items-center justify-between px-4 py-2 text-sm">
                          <span className="text-slate-700">{v.placa}</span>
                          <span className="font-semibold text-slate-800">{fmtKm(v.km)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <div className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Por motorista</div>
                    <ul className="divide-y divide-slate-100">
                      {ind.km.porMotorista.map((m) => (
                        <li key={m.motoristaId} className="flex items-center justify-between px-4 py-2 text-sm">
                          <span className="text-slate-700">{m.nomeMotorista || nomeUsuario(m.motoristaId)}</span>
                          <span className="font-semibold text-slate-800">{fmtKm(m.km)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ icon: Icon, cor, bg, valor, rotulo, sub }: {
  icon: typeof DollarSign; cor: string; bg: string; valor: number; rotulo: string; sub?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-4">
      <div className={`mb-2 inline-flex rounded-lg ${bg} p-1.5`}><Icon className={`h-4 w-4 ${cor}`} /></div>
      <div className="text-2xl font-semibold text-slate-800">{valor}</div>
      <div className="text-xs text-slate-500">{rotulo}</div>
      {sub && <div className="text-[11px] text-slate-400">{sub}</div>}
    </div>
  );
}

function StatTexto({ icon: Icon, cor, bg, valor, rotulo, sub }: {
  icon: typeof DollarSign; cor: string; bg: string; valor: string; rotulo: string; sub?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-4">
      <div className={`mb-2 inline-flex rounded-lg ${bg} p-1.5`}><Icon className={`h-4 w-4 ${cor}`} /></div>
      <div className="text-xl font-semibold text-slate-800">{valor}</div>
      <div className="text-xs text-slate-500">{rotulo}</div>
      {sub && <div className="text-[11px] text-slate-400">{sub}</div>}
    </div>
  );
}

const Vazio = () => <li className="px-4 py-3 text-sm text-slate-400">Sem dados.</li>;

/** Rosca (donut) SVG da participação do VALOR por origem — sem lib externa. */
function DonutOrigem({ itens, total }: { itens: OrigemInd[]; total: number }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  // Só origens com valor > 0; se o total for 0, donut cinza neutro.
  const fatias = itens.filter((o) => o.valor > 0);
  let acc = 0;
  const maior = [...itens].sort((a, b) => b.valor - a.valor)[0];
  const pctMaior = total > 0 && maior ? Math.round((maior.valor / total) * 100) : 0;

  return (
    <div className="flex items-center gap-5 px-4 py-4">
      <svg width={130} height={130} viewBox="0 0 130 130" className="shrink-0">
        <g transform="rotate(-90 65 65)">
          <circle cx={65} cy={65} r={r} fill="none" stroke="#f1f5f9" strokeWidth={16} />
          {total > 0 && fatias.map((o) => {
            const frac = o.valor / total;
            const seg = <circle
              key={o.origem}
              cx={65} cy={65} r={r} fill="none"
              stroke={corOrigem(o.origem)} strokeWidth={16}
              strokeDasharray={`${frac * c} ${c}`}
              strokeDashoffset={-acc * c}
            />;
            acc += frac;
            return seg;
          })}
        </g>
        <text x={65} y={61} textAnchor="middle" className="fill-slate-800" style={{ fontSize: 20, fontWeight: 700 }}>{pctMaior}%</text>
        <text x={65} y={78} textAnchor="middle" className="fill-slate-400" style={{ fontSize: 9 }}>
          {maior ? (ORIGEM_LABEL[maior.origem] ?? maior.origem) : '—'}
        </text>
      </svg>
      <div className="flex flex-col gap-1.5">
        {itens.map((o) => {
          const pct = total > 0 ? Math.round((o.valor / total) * 100) : 0;
          return (
            <div key={o.origem} className="flex items-center gap-2 text-xs">
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: corOrigem(o.origem) }} />
              <span className="text-slate-600">{ORIGEM_LABEL[o.origem] ?? o.origem}</span>
              <span className="font-medium text-slate-800">{pct}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
