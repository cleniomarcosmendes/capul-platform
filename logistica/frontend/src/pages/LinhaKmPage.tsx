import { useCallback, useEffect, useState } from 'react';
import { Car, ChevronLeft, ChevronRight, Gauge, Loader2, RefreshCw } from 'lucide-react';
import { logisticaApi } from '../services/api';
import { useToast } from '../components/Toast';
import { LinhaKmBarra, fmtKm, HACHURA, type LinhaKm } from '../components/LinhaKmBarra';

// Página dedicada "Linha do KM" (prestação de contas do odômetro). Espelha o
// layout do Acompanhamento do Workspace: filtro de mês + veículo (um ou todos)
// e uma faixa grande por veículo. Read-only (gestores). Substitui a barrinha
// que ficava espremida no rodapé do formulário do veículo.

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

interface VeiculoOpt { id: string; placa: string; modelo?: string | null }
interface Resp { mes: number | null; ano: number | null; veiculos: LinhaKm[] }

const fmtDate = (s?: string | null) => (s ? new Date(s).toLocaleDateString('pt-BR') : '—');

export function LinhaKmPage() {
  const { toast } = useToast();
  const agora = new Date();
  const [mes, setMes] = useState(agora.getMonth() + 1);
  const [ano, setAno] = useState(agora.getFullYear());
  const [veiculoId, setVeiculoId] = useState(''); // '' = todos
  const [veiculos, setVeiculos] = useState<VeiculoOpt[]>([]);
  const [linhas, setLinhas] = useState<LinhaKm[]>([]);
  const [loading, setLoading] = useState(true);

  const noMesAtual = ano === agora.getFullYear() && mes === agora.getMonth() + 1;
  const passoMes = (delta: number) => { const d = new Date(ano, mes - 1 + delta, 1); setMes(d.getMonth() + 1); setAno(d.getFullYear()); };

  useEffect(() => {
    logisticaApi.get<VeiculoOpt[]>('/veiculos').then((r) => setVeiculos(r.data)).catch(() => { /* lista é só conveniência */ });
  }, []);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await logisticaApi.get<Resp>('/frota/hodometro', { params: { mes, ano, veiculoId: veiculoId || undefined } });
      setLinhas(data.veiculos);
    } catch {
      toast('error', 'Falha ao carregar a linha do KM.');
    } finally { setLoading(false); }
  }, [mes, ano, veiculoId, toast]);
  useEffect(() => { void carregar(); }, [carregar]);

  const umVeiculo = !!veiculoId;
  const comDados = linhas.filter((l) => l.segmentos.length > 0);
  const semDados = linhas.length - comDados.length;
  const exibidas = umVeiculo ? linhas : comDados; // num veículo específico, mostro mesmo vazio (com aviso)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Gauge className="h-6 w-6 text-sky-600" />
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Linha do KM</h2>
            <p className="text-sm text-slate-500">Prestação de contas do odômetro: KM em viagens × não apontadas, por veículo.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={veiculoId} onChange={(e) => setVeiculoId(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none">
            <option value="">Todos os veículos</option>
            {veiculos.map((v) => <option key={v.id} value={v.id}>{v.placa}{v.modelo ? ` — ${v.modelo}` : ''}</option>)}
          </select>
          <button onClick={() => passoMes(-1)} className="rounded-lg border border-slate-300 p-1.5 text-slate-600 hover:bg-slate-50"><ChevronLeft className="h-4 w-4" /></button>
          <span className="min-w-[9.5rem] text-center text-sm font-medium text-slate-700">{MESES[mes - 1]} / {ano}</span>
          <button onClick={() => passoMes(1)} disabled={noMesAtual} className="rounded-lg border border-slate-300 p-1.5 text-slate-600 hover:bg-slate-50 disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
          <button onClick={() => void carregar()} className="ml-1 inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-slate-600 hover:bg-slate-50"><RefreshCw className="h-3.5 w-3.5" /> Atualizar</button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600">
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded bg-sky-500" /> Viagens (KM apontado)</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded" style={{ backgroundImage: HACHURA }} /> Não apontadas (lacuna de odômetro)</span>
        {noMesAtual && <span className="text-slate-400">A faixa inclui a lacuna até o KM atual do veículo.</span>}
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-20 text-slate-400"><Loader2 className="h-5 w-5 animate-spin" /> Carregando…</div>
      ) : exibidas.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-400">
          Sem viagens com KM apontado em {MESES[mes - 1]} / {ano}.
        </div>
      ) : (
        <div className="space-y-4">
          {exibidas.map((l) => (
            <div key={l.veiculoId} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <Car className="h-4 w-4 text-sky-600" /> {l.placa}{l.modelo ? <span className="font-normal text-slate-400"> · {l.modelo}</span> : null}
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
                  <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded bg-sky-500" /> Viagens: <b>{fmtKm(l.kmViagens)} km</b></span>
                  <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded" style={{ backgroundImage: HACHURA }} /> Não apontadas: <b>{fmtKm(l.kmNaoApontadas)} km</b></span>
                  <span className="text-slate-400">{l.qtdViagens} viagem{l.qtdViagens === 1 ? '' : 's'}</span>
                </div>
              </div>
              <LinhaKmBarra linha={l} altura={umVeiculo ? 'h-9' : 'h-7'} />
              {umVeiculo && l.segmentos.length > 0 && (
                <table className="mt-4 w-full text-sm">
                  <thead className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                    <tr><th className="px-3 py-2">Trecho</th><th className="px-3 py-2">Data</th><th className="px-3 py-2">Condutor</th><th className="px-3 py-2 text-right">Faixa de KM</th><th className="px-3 py-2 text-right">KM</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {l.segmentos.map((s, i) => (
                      <tr key={i} className={s.tipo === 'gap' ? 'bg-slate-50/60' : 'hover:bg-slate-50'}>
                        <td className="px-3 py-2">{s.tipo === 'gap' ? <span className="italic text-slate-400">{s.label}</span> : <span className="font-medium text-slate-700">Viagem #{s.viagemNumero}</span>}</td>
                        <td className="px-3 py-2 text-slate-500">{s.tipo === 'gap' ? '—' : fmtDate(s.data)}</td>
                        <td className="px-3 py-2 text-slate-500">{s.tipo === 'gap' ? '—' : (s.condutor ?? '—')}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-slate-600">{fmtKm(s.kmInicio)} – {fmtKm(s.kmFim)}</td>
                        <td className="px-3 py-2 text-right tabular-nums font-semibold text-slate-800">{fmtKm(s.km)} km</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ))}
          {!umVeiculo && semDados > 0 && (
            <p className="text-xs text-slate-400">{semDados} veículo{semDados === 1 ? '' : 's'} sem viagens com KM apontado neste mês {semDados === 1 ? 'foi omitido' : 'foram omitidos'}.</p>
          )}
        </div>
      )}
    </div>
  );
}
