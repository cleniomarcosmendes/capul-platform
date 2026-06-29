import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { logisticaApi } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import {
  ParadasPanel, RetornoForm, DespesaCondutorForm, AjusteForm,
  type ViagemFrota, type TipoDespesa,
} from './FrotaPage';
import { SIT_META, fmtDateTime, errMsg } from './frota-utils';

interface DespesaViagem { id: string; tipo: string; valor: number; fornecedor: string | null; situacao: string; dataDespesa: string }

const SIT_DESPESA: Record<string, string> = {
  PENDENTE: 'bg-amber-100 text-amber-700',
  APROVADA: 'bg-emerald-100 text-emerald-700',
  CONTESTADA: 'bg-rose-100 text-rose-700',
};

/** Detalhe de uma viagem de frota — operações (retorno/despesa/paradas/ajuste)
 *  em seções focadas, abertas ao clicar na linha do grid (lista → detalhe). */
export function FrotaViagemDetalhePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { logisticaRole } = useAuth();
  const ehGestor = logisticaRole === 'GESTOR_FROTA' || logisticaRole === 'ADMIN';

  const [viagem, setViagem] = useState<ViagemFrota | null>(null);
  const [tipos, setTipos] = useState<TipoDespesa[]>([]);
  const [despesas, setDespesas] = useState<DespesaViagem[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');

  const carregar = useCallback(async () => {
    if (!id) return;
    try {
      const [v, t, d] = await Promise.all([
        logisticaApi.get<ViagemFrota>(`/frota/viagens/${id}`),
        logisticaApi.get<TipoDespesa[]>('/despesas/tipos', { params: { ativos: 'true' } }),
        logisticaApi.get<DespesaViagem[]>(`/frota/viagens/${id}/despesas`),
      ]);
      setViagem(v.data);
      setTipos(t.data);
      setDespesas(d.data);
      setErro('');
    } catch (e) {
      setErro(errMsg(e, 'Rota não encontrada.'));
    } finally {
      setLoading(false);
    }
  }, [id]);
  useEffect(() => { void carregar(); }, [carregar]);

  const voltar = () => navigate('/frota');

  if (loading) {
    return <div className="flex items-center gap-2 p-8 text-slate-400"><Loader2 className="h-5 w-5 animate-spin" /> Carregando…</div>;
  }
  if (erro || !viagem) {
    return (
      <div className="p-8">
        <p className="text-rose-600">{erro || 'Rota não encontrada.'}</p>
        <button onClick={voltar} className="mt-3 inline-flex items-center gap-1 text-sm text-capul-600 hover:underline"><ArrowLeft className="h-4 w-4" /> Voltar</button>
      </div>
    );
  }

  const v = viagem;
  const sit = SIT_META[v.situacao] ?? { label: v.situacao, cls: 'bg-slate-100 text-slate-600' };
  const emCurso = v.situacao === 'EM_CURSO';
  // Gestor opera qualquer viagem; demais só a própria (registrante/supervisor). Senão, só leitura.
  const podeOperar = ehGestor || !!v.ehMinha;

  return (
    <div className="space-y-5">
      <button onClick={voltar} className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-800"><ArrowLeft className="h-4 w-4" /> Voltar para Saída de Veículos</button>

      {/* Cabeçalho da viagem */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Rota #{v.numero} · {v.placa}{v.modelo ? ` — ${v.modelo}` : ''}</h2>
            <p className="text-sm text-slate-500">Condutor: {v.condutorNome ?? '—'}{v.condutorMatricula ? ` · ${v.condutorMatricula}` : ''}</p>
          </div>
          <span className={`rounded-full px-3 py-1 text-sm font-medium ${sit.cls}`}>{sit.label}</span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <Info rotulo="Saída" valor={fmtDateTime(v.dataHoraSaida)} />
          <Info rotulo="Retorno" valor={fmtDateTime(v.dataHoraChegada)} />
          <Info rotulo="KM" valor={v.kmRodado != null ? `${v.kmRodado} km` : v.kmInicial != null ? `saída ${v.kmInicial}` : '—'} />
          <Info rotulo="Finalidade / destino" valor={v.finalidade ?? '—'} />
        </div>
        {v.localSaida && <p className="mt-3 text-sm text-slate-500">Local de saída: {v.localSaida}</p>}
      </div>

      {!podeOperar && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
          👁️ Somente leitura — você não é o responsável por esta operação. Apenas o gestor de frota, o supervisor do veículo ou quem registrou a saída podem alterá-la.
        </div>
      )}
      {emCurso && podeOperar && (
        <Secao cor="border-l-emerald-400">
          <RetornoForm v={v} onClose={voltar} onDone={() => void carregar()} />
        </Secao>
      )}
      {(emCurso || despesas.length > 0) && (
        <Secao cor="border-l-capul-400">
          {despesas.length > 0 && (
            <div className="mb-4">
              <p className="mb-2 text-sm font-semibold text-slate-700">Despesas lançadas ({despesas.length})</p>
              <div className="overflow-hidden rounded-lg border border-slate-200">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                    <tr><th className="px-3 py-2">Tipo</th><th className="px-3 py-2">Fornecedor</th><th className="px-3 py-2 text-right">Valor</th><th className="px-3 py-2">Situação</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {despesas.map((d) => (
                      <tr key={d.id}>
                        <td className="px-3 py-2 text-slate-700">{d.tipo}</td>
                        <td className="px-3 py-2 text-slate-500">{d.fornecedor ?? '—'}</td>
                        <td className="px-3 py-2 text-right tabular-nums">R$ {d.valor.toFixed(2)}</td>
                        <td className="px-3 py-2"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${SIT_DESPESA[d.situacao] ?? 'bg-slate-100 text-slate-600'}`}>{d.situacao}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {emCurso && podeOperar && <DespesaCondutorForm v={v} tipos={tipos} onClose={voltar} onDone={() => void carregar()} />}
        </Secao>
      )}
      <Secao cor="border-l-slate-300">
        <ParadasPanel v={v} podeEditar={podeOperar} onChanged={() => void carregar()} />
      </Secao>
      {emCurso && podeOperar && (
        <Secao cor="border-l-amber-400">
          <AjusteForm v={v} onClose={voltar} onDone={() => void carregar()} />
        </Secao>
      )}
    </div>
  );
}

function Info({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div>
      <p className="text-xs text-slate-400">{rotulo}</p>
      <p className="font-medium text-slate-700">{valor}</p>
    </div>
  );
}

function Secao({ cor, children }: { cor: string; children: ReactNode }) {
  return <div className={`rounded-xl border border-slate-200 border-l-4 ${cor} bg-white p-5 sm:p-6`}>{children}</div>;
}
