import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, Printer, Settings, Wallet, X } from 'lucide-react';
import { logisticaApi } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/toast-context';
import {
  ParadasPanel, RetornoForm, DespesaCondutorForm, AjusteForm, RetornoPortariaForm,
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
  const { toast } = useToast();
  const { logisticaRole } = useAuth();
  const ehGestor = logisticaRole === 'GESTOR_FROTA' || logisticaRole === 'ADMIN';
  const ehPortaria = logisticaRole === 'PORTARIA';
  // Cancelar saída (registrada errada) — gestor de frota (cross-filial) ou de entrega (própria filial).
  const podeCancelar = ehGestor || logisticaRole === 'GESTOR_ENTREGA';

  const [viagem, setViagem] = useState<ViagemFrota | null>(null);
  const [tipos, setTipos] = useState<TipoDespesa[]>([]);
  const [despesas, setDespesas] = useState<DespesaViagem[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  // Adiantamento (único) da viagem — editável por quem opera; base do "acerto".
  const [editAdiant, setEditAdiant] = useState(false);
  const [adiantVal, setAdiantVal] = useState('');
  const [salvandoAdiant, setSalvandoAdiant] = useState(false);
  // Ajuste de gestor = exceção (corrigir KM / forçar fecho) → nasce recolhido,
  // pra não competir com o "Registrar retorno" (caminho normal de fecho).
  const [mostrarAjuste, setMostrarAjuste] = useState(false);
  const [mostrarRetornoPortaria, setMostrarRetornoPortaria] = useState(false);
  const [mostrarCancelar, setMostrarCancelar] = useState(false);
  const [motivoCancel, setMotivoCancel] = useState('');
  const [cancelando, setCancelando] = useState(false);

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
  const salvarAdiantamento = async () => {
    setSalvandoAdiant(true);
    try {
      await logisticaApi.patch(`/frota/viagens/${id}`, { adiantamento: Number(adiantVal) || 0 });
      setEditAdiant(false); await carregar();
      toast('success', 'Adiantamento salvo.');
    } catch (e) { toast('error', errMsg(e, 'Falha ao salvar o adiantamento.')); } finally { setSalvandoAdiant(false); }
  };
  const cancelarSaida = async () => {
    if (!motivoCancel.trim()) { toast('warning', 'Informe o motivo do cancelamento.'); return; }
    setCancelando(true);
    try {
      await logisticaApi.patch(`/frota/viagens/${id}/cancelar`, { motivo: motivoCancel.trim() });
      toast('success', 'Saída cancelada. Veículo liberado.');
      navigate('/frota');
    } catch (e) { toast('error', errMsg(e, 'Falha ao cancelar a saída.')); } finally { setCancelando(false); }
  };

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
          <div className="flex items-center gap-2">
            <span className={`rounded-full px-3 py-1 text-sm font-medium ${sit.cls}`}>{sit.label}</span>
            <button onClick={() => navigate(`/frota/viagens/${id}/acerto`)} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50" title="Relatório de acerto (despesas × adiantamento)"><Printer className="h-4 w-4" /> Acerto</button>
            {emCurso && podeCancelar && !mostrarCancelar && (
              <button onClick={() => setMostrarCancelar(true)} className="inline-flex items-center gap-1 rounded-lg border border-rose-300 px-3 py-1.5 text-sm text-rose-700 hover:bg-rose-50" title="Cancelar saída registrada errada — libera o veículo"><X className="h-4 w-4" /> Cancelar saída</button>
            )}
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <Info rotulo="Saída" valor={fmtDateTime(v.dataHoraSaida)} />
          <Info rotulo="Retorno" valor={fmtDateTime(v.dataHoraChegada)} />
          <Info rotulo="KM" valor={v.kmRodado != null ? `${v.kmRodado} km` : v.kmInicial != null ? `saída ${v.kmInicial}` : '—'} />
          <Info rotulo="Finalidade / destino" valor={v.finalidade ?? '—'} />
        </div>
        {/* Adiantamento (único) — base do acerto; editável por quem opera, em qualquer status. */}
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <Wallet className="h-4 w-4 text-slate-400" />
          <span className="text-slate-500">Adiantamento:</span>
          {editAdiant ? (
            <>
              <input type="number" step="0.01" min="0" value={adiantVal} onChange={(e) => setAdiantVal(e.target.value)} placeholder="0,00" className="w-32 rounded-lg border border-slate-300 px-2 py-1 text-sm" />
              <button onClick={() => void salvarAdiantamento()} disabled={salvandoAdiant} className="rounded-lg bg-capul-600 px-3 py-1 text-xs font-medium text-white hover:bg-capul-700 disabled:opacity-50">{salvandoAdiant ? 'Salvando…' : 'Salvar'}</button>
              <button onClick={() => setEditAdiant(false)} className="text-xs text-slate-500 hover:text-slate-700">Cancelar</button>
            </>
          ) : (
            <>
              <b className="text-slate-700">{v.adiantamento != null ? `R$ ${v.adiantamento.toFixed(2)}` : '—'}</b>
              {podeOperar && <button onClick={() => { setAdiantVal(v.adiantamento != null ? String(v.adiantamento) : ''); setEditAdiant(true); }} className="text-xs text-capul-600 hover:underline">editar</button>}
            </>
          )}
        </div>
        {v.localSaida && <p className="mt-3 text-sm text-slate-500">Local de saída: {v.localSaida}</p>}
      </div>

      {emCurso && podeCancelar && mostrarCancelar && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3">
          <p className="mb-2 text-sm font-medium text-rose-700">Cancelar esta saída? O veículo volta a ficar <b>disponível</b>. <span className="font-normal">(Bloqueado se houver despesas lançadas — remova-as antes.)</span></p>
          <div className="flex flex-wrap items-center gap-2">
            <input value={motivoCancel} onChange={(e) => setMotivoCancel(e.target.value)} placeholder="Motivo do cancelamento (ex.: veículo/condutor trocado)" maxLength={255} className="min-w-[260px] flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <button onClick={() => void cancelarSaida()} disabled={cancelando} className="rounded-lg bg-rose-600 px-3 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50">{cancelando ? 'Cancelando…' : 'Confirmar cancelamento'}</button>
            <button onClick={() => { setMostrarCancelar(false); setMotivoCancel(''); }} className="rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-white">Voltar</button>
          </div>
        </div>
      )}

      {!podeOperar && !ehPortaria && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
          👁️ Somente leitura — você não é o responsável por esta operação. Apenas o gestor de frota, o supervisor do veículo ou quem registrou a saída podem alterá-la.
        </div>
      )}
      {emCurso && podeOperar && (
        <Secao cor="border-l-emerald-400">
          <RetornoForm v={v} onClose={voltar} onDone={() => void carregar()} />
        </Secao>
      )}
      {emCurso && (podeOperar || ehPortaria) && (
        mostrarRetornoPortaria ? (
          <Secao cor="border-l-amber-400">
            <RetornoPortariaForm v={v} onClose={() => setMostrarRetornoPortaria(false)} onDone={() => void carregar()} />
          </Secao>
        ) : (
          <button
            onClick={() => setMostrarRetornoPortaria(true)}
            className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-amber-700"
            title="Encerrar a rota pela portaria: KM final + matrícula/senha do porteiro, sem a senha do motorista"
          >
            🏁 Retorno pela portaria (sem senha do motorista)
          </button>
        )
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
        mostrarAjuste ? (
          <Secao cor="border-l-amber-400">
            <AjusteForm v={v} onClose={() => setMostrarAjuste(false)} onDone={() => void carregar()} />
          </Secao>
        ) : (
          <button
            onClick={() => setMostrarAjuste(true)}
            className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-amber-700"
            title="Corrigir KM ou forçar o fecho quando o condutor não fechou a rota"
          >
            <Settings className="h-4 w-4" /> Ajuste de gestor — corrigir KM / forçar fecho (exceção)
          </button>
        )
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
