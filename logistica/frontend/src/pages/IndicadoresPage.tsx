import { useEffect, useState } from 'react';
import {
  Loader2, ChevronLeft, ChevronRight, DollarSign, Boxes, Receipt, RefreshCw, MapPin,
} from 'lucide-react';
import { coreApi, logisticaApi } from '../services/api';

// Indicadores analíticos por MÊS (separados do Painel operacional em 12/06 —
// o Painel ficou denso demais). Valor por canal, performance por motorista,
// demanda por bairro e re-entregas. Read-only (GET /painel/indicadores).

interface CoreItem { id: string; nome?: string; codigo?: string; nomeFantasia?: string }
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

const labelCore = (i?: CoreItem) => (i ? i.nomeFantasia || i.nome || i.codigo || i.id.slice(0, 8) : '—');
const ORIGEM_LABEL: Record<string, string> = { PRESENCIAL: 'Presencial', TELE_VENDA: 'Tele-venda', OUTRO: 'Outro', NAO_INFORMADO: 'Não informado' };
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
          <h2 className="text-lg font-semibold text-slate-800">Indicadores</h2>
          <p className="text-sm text-slate-500">Valor por canal, performance por motorista, demanda e re-entregas — por mês.</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={filialId} onChange={(e) => setFilialId(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none">
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
  icon: typeof DollarSign; cor: string; bg: string; valor: number; rotulo: string; sub?: string;
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
  icon: typeof DollarSign; cor: string; bg: string; valor: string; rotulo: string; sub?: string;
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

const Vazio = () => <li className="px-4 py-3 text-sm text-slate-400">Sem dados.</li>;
