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
import { MoedaInput } from '../components/MoedaInput';

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
  const { toast, confirm } = useToast();
  const { usuario, temRole } = useAuth();
  const ehGestor = temRole('GESTOR_FROTA', 'ADMIN');
  const ehPortaria = temRole('PORTARIA');
  // Cancelar saída (registrada errada) — gestor de frota (cross-filial) ou de entrega (própria filial).
  const podeCancelar = ehGestor || temRole('GESTOR_ENTREGA');

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
  // Correção da despesa no próprio acerto (o condutor identificado também pode).
  const [editandoDespesa, setEditandoDespesa] = useState<string | null>(null);
  const [valorEdit, setValorEdit] = useState('');
  const [salvandoDespesa, setSalvandoDespesa] = useState(false);
  // 5a — ACERTO com login PADRÃO. A conta de caixa é compartilhada, então quem
  // responde pelo acerto é a PESSOA: ela se identifica com matrícula+senha e recebe um
  // token preso a {viagem, condutor}. Sem isso, prestar contas pelo desktop era
  // privilégio de quem tem login INDIVIDUAL.
  const ehPadrao = usuario?.tipo === 'PADRAO';
  const [condutorToken, setCondutorToken] = useState('');
  const [condutorIdent, setCondutorIdent] = useState<string | null>(null);
  const [matCond, setMatCond] = useState('');
  const [senhaCond, setSenhaCond] = useState('');
  const [identificando, setIdentificando] = useState(false);

  /** Cabeçalho do condutor identificado — vai nas ações do acerto. */
  const hdrCondutor = condutorToken ? { headers: { 'x-condutor-token': condutorToken } } : undefined;

  const identificarCondutor = async () => {
    if (!matCond.trim() || !senhaCond) { toast('warning', 'Informe matrícula e senha.'); return; }
    setIdentificando(true);
    try {
      // SEMPRE 200 {valida, motivo} — senha errada não pode virar 401 (o interceptor
      // desloga em 401; ver a regra do módulo).
      const r = await logisticaApi.post<{ valida: boolean; motivo?: string; token?: string; condutorNome?: string }>(
        `/frota/viagens/${id}/autenticar-condutor`, { matricula: matCond.trim(), senha: senhaCond });
      if (!r.data.valida || !r.data.token) {
        const msg = r.data.motivo === 'NAO_E_O_CONDUTOR'
          ? 'Esta matrícula não é a do condutor desta viagem.'
          : r.data.motivo === 'INDISPONIVEL'
            ? 'Portal do RH indisponível. Tente novamente em instantes.'
            : 'Matrícula ou senha inválidas.';
        toast('warning', msg);
        return;
      }
      setCondutorToken(r.data.token);
      setCondutorIdent(r.data.condutorNome ?? matCond.trim());
      setSenhaCond('');
      toast('success', 'Condutor identificado — pode lançar o acerto.');
    } catch (e) { toast('error', errMsg(e, 'Falha ao identificar o condutor.')); }
    finally { setIdentificando(false); }
  };

  const salvarDespesa = async (id: string) => {
    const valor = Number(valorEdit);
    if (!Number.isFinite(valor) || valor <= 0) { toast('warning', 'Informe um valor válido.'); return; }
    setSalvandoDespesa(true);
    try {
      await logisticaApi.patch(`/despesas/${id}`, { valor }, hdrCondutor);
      toast('success', 'Despesa atualizada.');
      setEditandoDespesa(null);
      await carregar();
    } catch (e) { toast('error', errMsg(e, 'Falha ao atualizar a despesa.')); }
    finally { setSalvandoDespesa(false); }
  };

  const excluirDespesa = async (id: string, valor: number) => {
    const ok = await confirm('Excluir despesa', `Remover a despesa de R$ ${valor.toFixed(2)} deste acerto? Esta ação não pode ser desfeita.`, { confirmLabel: 'Excluir', variant: 'danger' });
    if (!ok) return;
    try {
      await logisticaApi.delete(`/despesas/${id}`, hdrCondutor);
      toast('success', 'Despesa excluída.');
      await carregar();
    } catch (e) { toast('error', errMsg(e, 'Falha ao excluir a despesa.')); }
  };

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
      await logisticaApi.patch(`/frota/viagens/${id}`, { adiantamento: Number(adiantVal) || 0 }, hdrCondutor);
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
  // Condutor identificado (login PADRÃO) opera o acerto DESTA viagem — a autoridade é
  // da PESSOA que digitou matrícula+senha, não da conta de caixa compartilhada.
  const podeOperar = ehGestor || !!v.ehMinha || !!condutorToken;
  // Acerto encerrado (independente da conclusão) trava despesa/adiantamento. Enquanto
  // aberto, dá pra lançar durante a viagem E no acerto (após a entrega do veículo).
  const acertoEncerrado = !!v.acertoEncerradoEm;
  const podeLancar = podeOperar && !acertoEncerrado && v.situacao !== 'CANCELADA';
  const podeEncerrarAcerto = podeOperar && !acertoEncerrado && v.situacao === 'CONCLUIDA';
  const acaoAcerto = async (path: string, msg: string) => {
    try { await logisticaApi.post(`/frota/viagens/${id}/${path}`, {}); toast('success', msg); await carregar(); }
    catch (e) { toast('error', errMsg(e, 'Falha ao alterar o acerto.')); }
  };

  return (
    <div className="space-y-5">
      <button onClick={voltar} className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-800"><ArrowLeft className="h-4 w-4" /> Voltar para Registro de Viagem</button>

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
            {podeEncerrarAcerto && (
              <button onClick={() => void acaoAcerto('encerrar-acerto', 'Acerto encerrado.')} className="inline-flex items-center gap-1 rounded-lg border border-amber-300 px-3 py-1.5 text-sm text-amber-700 hover:bg-amber-50" title="Trava despesas e adiantamento deste acerto">🔒 Encerrar acerto</button>
            )}
            {acertoEncerrado && podeOperar && (
              <button onClick={() => void acaoAcerto('reabrir-acerto', 'Acerto reaberto.')} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50" title="Reabre para lançar despesas/adiantamento">🔓 Reabrir acerto</button>
            )}
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
        {/* 5a — ACERTO com login PADRÃO (caixa/portaria). A conta é compartilhada, então
            quem responde pelo acerto é a PESSOA: identifica-se com matrícula+senha e
            recebe um token preso a ESTA viagem. Antes o desktop não tinha esse caminho, e
            prestar contas acabava sendo privilégio de quem tem login INDIVIDUAL. */}
        {ehPadrao && !acertoEncerrado && v.situacao !== 'CANCELADA' && (
          condutorToken ? (
            <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              ✓ Identificado como <b>{condutorIdent}</b> — lançamentos deste acerto ficam no nome dele.
            </div>
          ) : (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3">
              <p className="mb-2 text-sm text-amber-800">
                Login compartilhado: para lançar o acerto, o <b>condutor</b> desta viagem precisa se identificar.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  value={matCond} onChange={(e) => setMatCond(e.target.value)} placeholder="Matrícula"
                  className="w-36 rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm"
                />
                <input
                  type="password" value={senhaCond} onChange={(e) => setSenhaCond(e.target.value)} placeholder="Senha"
                  onKeyDown={(e) => { if (e.key === 'Enter') void identificarCondutor(); }}
                  className="w-40 rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm"
                />
                <button
                  onClick={() => void identificarCondutor()} disabled={identificando}
                  className="rounded-lg bg-capul-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-capul-700 disabled:opacity-50"
                >{identificando ? 'Validando…' : 'Identificar'}</button>
              </div>
            </div>
          )
        )}

        {/* Adiantamento (único) — base do acerto; editável por quem opera, em qualquer status. */}
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <Wallet className="h-4 w-4 text-slate-400" />
          <span className="text-slate-500">Adiantamento:</span>
          {editAdiant ? (
            <>
              <MoedaInput value={adiantVal} onChange={setAdiantVal} placeholder="0,00" className="w-32 rounded-lg border border-slate-300 px-2 py-1 text-sm" />
              <button onClick={() => void salvarAdiantamento()} disabled={salvandoAdiant} className="rounded-lg bg-capul-600 px-3 py-1 text-xs font-medium text-white hover:bg-capul-700 disabled:opacity-50">{salvandoAdiant ? 'Salvando…' : 'Salvar'}</button>
              <button onClick={() => setEditAdiant(false)} className="text-xs text-slate-500 hover:text-slate-700">Cancelar</button>
            </>
          ) : (
            <>
              <b className="text-slate-700">{v.adiantamento != null ? `R$ ${v.adiantamento.toFixed(2)}` : '—'}</b>
              {podeLancar && <button onClick={() => { setAdiantVal(v.adiantamento != null ? String(v.adiantamento) : ''); setEditAdiant(true); }} className="text-xs text-capul-600 hover:underline">editar</button>}
              {acertoEncerrado && <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">🔒 Acerto encerrado — reabra para alterar</span>}
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
      {(emCurso || despesas.length > 0 || podeLancar) && (
        <Secao cor="border-l-capul-400">
          {despesas.length > 0 && (
            <div className="mb-4">
              <p className="mb-2 text-sm font-semibold text-slate-700">Despesas lançadas ({despesas.length})</p>
              <div className="overflow-hidden rounded-lg border border-slate-200">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                    <tr><th className="px-3 py-2">Tipo</th><th className="px-3 py-2">Fornecedor</th><th className="px-3 py-2 text-right">Valor</th><th className="px-3 py-2">Situação</th><th className="px-3 py-2" /></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {despesas.map((d) => (
                      <tr key={d.id}>
                        <td className="px-3 py-2 text-slate-700">{d.tipo}</td>
                        <td className="px-3 py-2 text-slate-500">{d.fornecedor ?? '—'}</td>
                        <td className="px-3 py-2 text-right tabular-nums">R$ {d.valor.toFixed(2)}</td>
                        <td className="px-3 py-2"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${SIT_DESPESA[d.situacao] ?? 'bg-slate-100 text-slate-600'}`}>{d.situacao}</span></td>
                        {/* Corrigir o próprio acerto: quem lançou erra o valor e precisa
                            arrumar ali mesmo. Sem isto o condutor identificado só
                            INCLUÍA — editar/excluir exigia a tela de Custos da Frota,
                            que é de gestor. Era metade do 5a. */}
                        <td className="px-3 py-2 text-right whitespace-nowrap">
                          {podeLancar && (editandoDespesa === d.id ? (
                            <span className="inline-flex items-center gap-1">
                              <MoedaInput value={valorEdit} onChange={setValorEdit} className="w-24 rounded border border-slate-300 px-2 py-1 text-xs" />
                              <button onClick={() => void salvarDespesa(d.id)} disabled={salvandoDespesa} className="rounded bg-capul-600 px-2 py-1 text-xs font-medium text-white hover:bg-capul-700 disabled:opacity-50">Salvar</button>
                              <button onClick={() => setEditandoDespesa(null)} className="text-xs text-slate-500 hover:text-slate-700">Cancelar</button>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-2">
                              <button onClick={() => { setEditandoDespesa(d.id); setValorEdit(String(d.valor)); }} className="text-xs text-capul-600 hover:underline">editar</button>
                              <button onClick={() => void excluirDespesa(d.id, d.valor)} className="text-xs text-rose-600 hover:underline">excluir</button>
                            </span>
                          ))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {podeLancar && <DespesaCondutorForm v={v} tipos={tipos} onClose={voltar} onDone={() => void carregar()} condutorToken={condutorToken || undefined} />}
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
            <Settings className="h-4 w-4" /> Ajuste da rota — corrigir KM / forçar fecho (exceção)
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
