import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Loader2, RefreshCw, TrendingUp, Car, Tag } from 'lucide-react';
import { logisticaApi } from '../services/api';
import { useToast } from '../components/Toast';

// Indicadores analíticos de DESPESA da frota por MÊS (separados do Monitor da
// Frota, que é tempo real). Espelha a separação Painel × Indicadores das
// entregas. Read-only (GET /despesas/indicadores).

interface Indicadores {
  total: number;
  porVeiculo: { nome: string; valor: number }[];
  porTipo: { nome: string; valor: number }[];
}

const BRL = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const errMsg = (e: unknown, fb: string) => {
  const m = (e as { response?: { data?: { message?: unknown } } })?.response?.data?.message;
  return Array.isArray(m) ? m.join(', ') : (typeof m === 'string' ? m : fb);
};

export function FrotaIndicadoresPage() {
  const { toast } = useToast();
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

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await logisticaApi.get<Indicadores>('/despesas/indicadores', { params: { mes, ano } });
      setInd(data);
    } catch (e) {
      toast('error', errMsg(e, 'Falha ao carregar indicadores.'));
    } finally {
      setLoading(false);
    }
  }, [mes, ano, toast]);
  useEffect(() => { void carregar(); }, [carregar]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <TrendingUp className="h-6 w-6 text-sky-600" />
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Indicadores da Frota</h2>
            <p className="text-sm text-slate-500">Custo das despesas aprovadas por mês — por veículo e por tipo.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => passoMes(-1)} className="rounded-lg border border-slate-300 p-1.5 text-slate-600 hover:bg-slate-50" title="Mês anterior"><ChevronLeft className="h-4 w-4" /></button>
          <span className="min-w-[9.5rem] text-center text-sm font-medium text-slate-700">{MESES[mes - 1]} / {ano}</span>
          <button onClick={() => passoMes(1)} disabled={noMesAtual} className="rounded-lg border border-slate-300 p-1.5 text-slate-600 hover:bg-slate-50 disabled:opacity-40" title="Próximo mês"><ChevronRight className="h-4 w-4" /></button>
          <button onClick={() => void carregar()} className="ml-1 inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-slate-600 hover:bg-slate-50"><RefreshCw className="h-3.5 w-3.5" /> Atualizar</button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-20 text-slate-400"><Loader2 className="h-5 w-5 animate-spin" /> Carregando…</div>
      ) : !ind ? null : (
        <>
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Total aprovado no mês</p>
            <p className="mt-1 text-3xl font-semibold text-slate-800">{BRL(ind.total)}</p>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <RankBox titulo="Por veículo" icon={<Car className="h-4 w-4 text-slate-400" />} itens={ind.porVeiculo} total={ind.total} />
            <RankBox titulo="Por tipo de despesa" icon={<Tag className="h-4 w-4 text-slate-400" />} itens={ind.porTipo} total={ind.total} />
          </div>
        </>
      )}
    </div>
  );
}

function RankBox({ titulo, icon, itens, total }: { titulo: string; icon: React.ReactNode; itens: { nome: string; valor: number }[]; total: number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-700">{icon} {titulo}</div>
      {itens.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-slate-400">Sem despesas aprovadas no mês.</div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {itens.map((i) => {
            const pct = total > 0 ? Math.round((i.valor / total) * 100) : 0;
            return (
              <li key={i.nome} className="px-4 py-2.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-700">{i.nome}</span>
                  <span className="tabular-nums font-medium text-slate-800">{BRL(i.valor)} <span className="text-xs font-normal text-slate-400">· {pct}%</span></span>
                </div>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-sky-400" style={{ width: `${pct}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
