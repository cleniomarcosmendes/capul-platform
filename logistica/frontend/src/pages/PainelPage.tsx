import { useEffect, useMemo, useState } from 'react';
import {
  Loader2, Package, Truck, CheckCircle2, XCircle, Route, Car, Timer,
  ChevronLeft, ChevronRight, DollarSign, Boxes, Receipt, RefreshCw, BarChart3, MapPin,
} from 'lucide-react';
import { coreApi, logisticaApi } from '../services/api';

interface CoreItem { id: string; nome?: string; codigo?: string; nomeFantasia?: string }

// ── Indicadores analíticos por mês (pedido 12/06) ──
interface OrigemInd { origem: string; entregas: number; volumes: number; valor: number; ticketMedio: number }
interface MotoristaInd { motoristaId: string; nomeMotorista?: string | null; total: number; entregues: number; naoEntregues: number; volumes: number; taxaSucesso: number | null }
interface DemandaInd { cidade: string | null; bairro: string; total: number }
interface Indicadores {
  filtros: { filialId: string | null; mes: number; ano: number };
  totais: { entregas: number; volumes: number; valorTotal: number; ticketMedio: number; reentregas: number; taxaReentrega: number };
  porOrigem: OrigemInd[];
  porMotorista: MotoristaInd[];
  demanda: DemandaInd[];
}

const ORIGEM_LABEL: Record<string, string> = { PRESENCIAL: 'Presencial', TELE_VENDA: 'Tele-venda', OUTRO: 'Outro', NAO_INFORMADO: 'Não informado' };
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtPct = (v: number | null | undefined) => (v == null ? '—' : `${Math.round(v * 100)}%`);
interface Painel {
  filtros: { filialId: string | null; dias: number };
  cards: {
    entregasPendentes: number; entregasEmViagem: number; entregasEntregues: number;
    entregasNaoEntregues: number; entregasCanceladas: number;
    viagensRascunho: number; viagensEmCurso: number; viagensConcluidas: number;
    veiculosDisponiveis: number; veiculosEmUso: number; veiculosManutencao: number;
  };
  porDia: { dia: string; criadas: number; despachadas: number }[];
  porFilial: { filialId: string; nomeFilial?: string | null; pendentes: number; emViagem: number; entregues: number; total: number }[];
  porVeiculo: { veiculoId: string; placa: string; viagens: number }[];
  porMotorista: { motoristaId: string; nomeMotorista?: string | null; viagens: number }[];
  porOrigem?: { origem: string; total: number }[];
  prazoMedio?: { horas: number | null; amostra: number };
}

const labelCore = (i?: CoreItem) => (i ? i.nomeFantasia || i.nome || i.codigo || i.id.slice(0, 8) : '—');
const fmtPrazo = (horas: number | null | undefined) => {
  if (horas == null) return '—';
  if (horas < 1) return `${Math.round(horas * 60)} min`;
  if (horas < 48) return `${Math.floor(horas)}h ${Math.round((horas % 1) * 60)}m`;
  return `${Math.floor(horas / 24)}d ${Math.round(horas % 24)}h`;
};
const diaCurto = (iso: string) => {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
};

export function PainelPage() {
  const [data, setData] = useState<Painel | null>(null);
  const [filiais, setFiliais] = useState<CoreItem[]>([]);
  const [usuarios, setUsuarios] = useState<CoreItem[]>([]);
  const [filialId, setFilialId] = useState('');
  const [dias, setDias] = useState(14);
  const [loading, setLoading] = useState(true);

  // Indicadores do mês (seção analítica, seletor de mês — padrão workspace).
  const agora = new Date();
  const [mes, setMes] = useState(agora.getMonth() + 1);
  const [ano, setAno] = useState(agora.getFullYear());
  const [ind, setInd] = useState<Indicadores | null>(null);
  const [loadingInd, setLoadingInd] = useState(true);
  // Não deixa navegar para o futuro.
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
      .get<Painel>('/painel', { params: { ...(filialId ? { filialId } : {}), dias } })
      .then((r) => setData(r.data))
      .finally(() => setLoading(false));
  }, [filialId, dias]);

  useEffect(() => {
    setLoadingInd(true);
    logisticaApi
      .get<Indicadores>('/painel/indicadores', { params: { ...(filialId ? { filialId } : {}), mes, ano } })
      .then((r) => setInd(r.data))
      .finally(() => setLoadingInd(false));
  }, [filialId, mes, ano]);

  const nomeFilial = (id: string) => labelCore(filiais.find((x) => x.id === id));
  const nomeUsuario = (id: string) => labelCore(usuarios.find((x) => x.id === id));
  const maxDia = useMemo(
    () => Math.max(1, ...(data?.porDia.flatMap((d) => [d.criadas, d.despachadas]) ?? [1])),
    [data],
  );

  const c = data?.cards;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Painel</h2>
          <p className="text-sm text-slate-500">Indicadores operacionais de entregas e frota.</p>
        </div>
        <div className="flex gap-2">
          <select value={filialId} onChange={(e) => setFilialId(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none">
            <option value="">Todas as filiais</option>
            {filiais.map((f) => <option key={f.id} value={f.id}>{labelCore(f)}</option>)}
          </select>
          <select value={dias} onChange={(e) => setDias(Number(e.target.value))}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none">
            <option value={7}>Últimos 7 dias</option>
            <option value={14}>Últimos 14 dias</option>
            <option value={30}>Últimos 30 dias</option>
          </select>
        </div>
      </div>

      {loading || !c ? (
        <div className="flex items-center gap-2 p-6 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Carregando…</div>
      ) : (
        <>
          {/* Cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
            <Stat icon={Package} cor="text-amber-600" bg="bg-amber-50" valor={c.entregasPendentes} rotulo="Pendentes" />
            <Stat icon={Truck} cor="text-sky-600" bg="bg-sky-50" valor={c.entregasEmViagem} rotulo="Em viagem" />
            <Stat icon={CheckCircle2} cor="text-emerald-600" bg="bg-emerald-50" valor={c.entregasEntregues} rotulo="Entregues" />
            <Stat icon={XCircle} cor="text-rose-600" bg="bg-rose-50" valor={c.entregasNaoEntregues} rotulo="Não entregues" />
            <Stat icon={XCircle} cor="text-slate-500" bg="bg-slate-100" valor={c.entregasCanceladas} rotulo="Canceladas" />
            <Stat icon={Route} cor="text-indigo-600" bg="bg-indigo-50" valor={c.viagensEmCurso} rotulo="Viagens em curso" />
            <Stat icon={Car} cor="text-slate-600" bg="bg-slate-100" valor={c.veiculosEmUso} rotulo="Veíc. em uso" sub={`${c.veiculosDisponiveis} disp.`} />
            <StatTexto icon={Timer} cor="text-violet-600" bg="bg-violet-50"
              valor={fmtPrazo(data.prazoMedio?.horas)} rotulo="Prazo médio de entrega"
              sub={data.prazoMedio?.amostra ? `${data.prazoMedio.amostra} entregas no período` : 'sem entregas no período'} />
          </div>

          {/* Por dia */}
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-700">Movimento por dia</h3>
              <div className="flex gap-3 text-xs text-slate-500">
                <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm bg-sky-500" /> Criadas</span>
                <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm bg-emerald-500" /> Despachadas</span>
              </div>
            </div>
            <div className="flex items-end gap-2 overflow-x-auto" style={{ height: 160 }}>
              {data.porDia.map((d) => (
                <div key={d.dia} className="flex min-w-[28px] flex-1 flex-col items-center gap-1">
                  <div className="flex w-full flex-1 items-end justify-center gap-0.5">
                    <div className="w-1/2 rounded-t bg-sky-500" style={{ height: `${(d.criadas / maxDia) * 100}%` }} title={`${d.criadas} criadas`} />
                    <div className="w-1/2 rounded-t bg-emerald-500" style={{ height: `${(d.despachadas / maxDia) * 100}%` }} title={`${d.despachadas} despachadas`} />
                  </div>
                  <span className="text-[10px] text-slate-400">{diaCurto(d.dia)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Tabelas */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-4">
            <Tabela titulo="Por filial">
              {data.porFilial.length === 0 ? <Vazio /> : data.porFilial.map((f) => (
                <Linha key={f.filialId} esq={f.nomeFilial || nomeFilial(f.filialId)}
                  dir={<span><b>{f.total}</b> <span className="text-slate-400">({f.pendentes} pend · {f.emViagem} em viagem)</span></span>} />
              ))}
            </Tabela>
            <Tabela titulo="Viagens por veículo">
              {data.porVeiculo.length === 0 ? <Vazio /> : data.porVeiculo.map((v) => (
                <Linha key={v.veiculoId} esq={<span className="font-mono">{v.placa}</span>} dir={<b>{v.viagens}</b>} />
              ))}
            </Tabela>
            <Tabela titulo="Origem da venda">
              {(data.porOrigem?.length ?? 0) === 0 ? <Vazio /> : data.porOrigem!.map((o) => (
                <Linha key={o.origem}
                  esq={{ PRESENCIAL: 'Presencial', TELE_VENDA: 'Tele-venda', OUTRO: 'Outro', NAO_INFORMADO: 'Não informado' }[o.origem] ?? o.origem}
                  dir={<b>{o.total}</b>} />
              ))}
            </Tabela>
            <Tabela titulo="Viagens por motorista">
              {data.porMotorista.length === 0 ? <Vazio /> : data.porMotorista.map((m) => (
                <Linha key={m.motoristaId} esq={m.nomeMotorista || nomeUsuario(m.motoristaId)} dir={<b>{m.viagens}</b>} />
              ))}
            </Tabela>
          </div>
        </>
      )}

      {/* ───────────────── Indicadores do mês ───────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-6">
        <div>
          <h3 className="flex items-center gap-2 text-base font-semibold text-slate-800">
            <BarChart3 className="h-5 w-5 text-sky-600" /> Indicadores do mês
          </h3>
          <p className="text-sm text-slate-500">Valor por canal, performance por motorista, demanda e re-entregas.</p>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-slate-300 bg-white p-1">
          <button onClick={() => passoMes(-1)} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100" title="Mês anterior">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[140px] text-center text-sm font-medium text-slate-700">{MESES[mes - 1]} {ano}</span>
          <button onClick={() => passoMes(1)} disabled={noMesAtual}
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-30" title="Próximo mês">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {loadingInd || !ind ? (
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
            <Stat icon={Boxes} cor="text-sky-600" bg="bg-sky-50" valor={ind.totais.volumes} rotulo="Volumes transportados" />
            <StatTexto icon={Receipt} cor="text-indigo-600" bg="bg-indigo-50" valor={fmtBRL(ind.totais.ticketMedio)} rotulo="Ticket médio" sub="valor ÷ entregas" />
            <Stat icon={RefreshCw} cor="text-amber-600" bg="bg-amber-50" valor={ind.totais.reentregas} rotulo="Re-entregas (2ª tentativa)" sub={`${fmtPct(ind.totais.taxaReentrega)} do total`} />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Valor por tipo de venda */}
            <div className="rounded-xl border border-slate-200 bg-white">
              <div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-700">Valor por tipo de venda</div>
              {ind.porOrigem.length === 0 ? <Vazio /> : (
                <ul className="divide-y divide-slate-100">
                  {ind.porOrigem.map((o) => {
                    const pct = ind.totais.valorTotal > 0 ? (o.valor / ind.totais.valorTotal) * 100 : 0;
                    return (
                      <li key={o.origem} className="px-4 py-2.5">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-700">{ORIGEM_LABEL[o.origem] ?? o.origem}</span>
                          <span className="font-semibold text-slate-800">{fmtBRL(o.valor)}</span>
                        </div>
                        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
                        </div>
                        <div className="mt-1 text-xs text-slate-400">{o.entregas} entregas · {o.volumes} vol · ticket {fmtBRL(o.ticketMedio)}</div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {/* Demanda por bairro */}
            <div className="rounded-xl border border-slate-200 bg-white">
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
          <div className="rounded-xl border border-slate-200 bg-white">
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
            <p className="px-4 py-2 text-xs text-slate-400">Taxa de sucesso = entregues ÷ (entregues + não entregues). KM rodados virá quando habilitarmos a captura de hodômetro.</p>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ icon: Icon, cor, bg, valor, rotulo, sub }: {
  icon: typeof Package; cor: string; bg: string; valor: number; rotulo: string; sub?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className={`mb-2 inline-flex rounded-lg ${bg} p-1.5`}><Icon className={`h-4 w-4 ${cor}`} /></div>
      <div className="text-2xl font-semibold text-slate-800">{valor}</div>
      <div className="text-xs text-slate-500">{rotulo}</div>
      {sub && <div className="text-[11px] text-slate-400">{sub}</div>}
    </div>
  );
}

function StatTexto({ icon: Icon, cor, bg, valor, rotulo, sub }: {
  icon: typeof Package; cor: string; bg: string; valor: string; rotulo: string; sub?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className={`mb-2 inline-flex rounded-lg ${bg} p-1.5`}><Icon className={`h-4 w-4 ${cor}`} /></div>
      <div className="text-xl font-semibold text-slate-800">{valor}</div>
      <div className="text-xs text-slate-500">{rotulo}</div>
      {sub && <div className="text-[11px] text-slate-400">{sub}</div>}
    </div>
  );
}

function Tabela({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-700">{titulo}</div>
      <ul className="divide-y divide-slate-100">{children}</ul>
    </div>
  );
}

function Linha({ esq, dir }: { esq: React.ReactNode; dir: React.ReactNode }) {
  return (
    <li className="flex items-center justify-between px-4 py-2 text-sm">
      <span className="text-slate-700">{esq}</span>
      <span className="text-slate-600">{dir}</span>
    </li>
  );
}

const Vazio = () => <li className="px-4 py-3 text-sm text-slate-400">Sem dados.</li>;
