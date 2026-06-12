import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, Pencil, Phone, Printer } from 'lucide-react';
import { logisticaApi } from '../services/api';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { maskTelefone, maskCep } from '../utils/format';

// Detalhe da Entrega (padrão workspace — página, não modal): seções de
// informação + ações no topo. Edição em /entregas/:id/editar (mesmo form
// da Nova Entrega, modo edição).

type Status = 'PENDENTE' | 'EM_VIAGEM' | 'ENTREGUE' | 'NAO_ENTREGUE' | 'CANCELADA';
type Origem = 'PRESENCIAL' | 'TELE_VENDA' | 'OUTRO';

interface Cupom { numeroCupom?: string | null; valor?: string | number | null }
interface TentativaHist { tentativa: number; motivo?: string | null; dataHora?: string | null; viagemNumero?: number | null }
interface Entrega {
  id: string; numero: number; criadoEm: string; status: Status;
  destinatarioNome: string; telefone?: string | null; matricula?: string | null; tipoCliente: string;
  endLogradouro: string; endNumero?: string | null; endComplemento?: string | null;
  endBairro?: string | null; endCidade?: string | null; endUf?: string | null; endCep?: string | null;
  endReferencia?: string | null; horario?: string | null; observacoes?: string | null;
  quantidadeVolumes: number; origemVenda?: Origem | null; tentativas?: number;
  historicoTentativas?: TentativaHist[] | null;
  totalCupons: number; cupons: Cupom[];
  viagemNumero?: number | null; viagemSituacao?: string | null;
  motivoNaoEntrega?: string | null; dataHoraEntrega?: string | null;
  motivoCancelamento?: string | null;
}

const STATUS_META: Record<Status, { label: string; cls: string }> = {
  PENDENTE: { label: 'Pendente', cls: 'bg-sky-100 text-sky-700' },
  EM_VIAGEM: { label: 'Em viagem', cls: 'bg-amber-100 text-amber-700' },
  ENTREGUE: { label: 'Entregue', cls: 'bg-emerald-100 text-emerald-700' },
  NAO_ENTREGUE: { label: 'Não entregue', cls: 'bg-rose-100 text-rose-700' },
  CANCELADA: { label: 'Cancelada', cls: 'bg-slate-100 text-slate-500' },
};
const ORIGEM_LABEL: Record<Origem, string> = { PRESENCIAL: 'Presencial', TELE_VENDA: 'Tele-venda', OUTRO: 'Outro' };
const TIPO_LABEL: Record<string, string> = { IDENTIFICADO: 'Com matrícula', RECORRENTE_LOCAL: 'Recorrente (local)', EVENTUAL: 'Eventual' };

export function EntregaDetalhePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [e, setE] = useState<Entrega | null>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmacao, setConfirmacao] = useState<{ titulo: string; mensagem: string; acao: () => Promise<void> } | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await logisticaApi.get<Entrega>(`/entregas/${id}`);
      setE(data);
    } catch {
      setMsg({ tipo: 'erro', texto: 'Entrega não encontrada.' });
    } finally { setLoading(false); }
  }, [id]);
  useEffect(() => { void carregar(); }, [carregar]);

  const editavel = e?.status === 'PENDENTE' && e?.viagemNumero == null;

  async function novaTentativa() {
    if (!e) return;
    setBusy(true);
    setMsg(null);
    try {
      await logisticaApi.post(`/entregas/${e.id}/nova-tentativa`, {});
      setMsg({ tipo: 'ok', texto: 'Entrega voltou pra fila de pendentes (nova tentativa).' });
      void carregar();
    } catch (err) {
      const m = (err as { response?: { data?: { message?: string } } }).response?.data?.message;
      setMsg({ tipo: 'erro', texto: Array.isArray(m) ? m.join(', ') : m || 'Falha ao reabrir.' });
    } finally { setBusy(false); }
  }

  async function cancelar() {
    if (!e) return;
    setBusy(true);
    setMsg(null);
    try {
      await logisticaApi.post(`/entregas/${e.id}/cancelar`, { motivo: 'Cancelada no balcão' });
      void carregar();
    } catch (err) {
      const m = (err as { response?: { data?: { message?: string } } }).response?.data?.message;
      setMsg({ tipo: 'erro', texto: Array.isArray(m) ? m.join(', ') : m || 'Falha ao cancelar.' });
    } finally { setBusy(false); }
  }

  const lbl = 'block text-xs font-medium text-slate-500';
  const card = 'rounded-xl border border-slate-200 bg-white p-5';

  if (loading) return <div className="p-6 text-sm text-slate-500"><Loader2 className="inline h-4 w-4 animate-spin" /> Carregando…</div>;
  if (!e) return (
    <div className="space-y-4">
      {msg && <div className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{msg.texto}</div>}
      <Link to="/entregas" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"><ArrowLeft className="h-4 w-4" /> Voltar</Link>
    </div>
  );

  return (
    <div className="max-w-3xl space-y-4">
      <Link to="/entregas" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft className="h-4 w-4" /> Voltar para Entregas
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-slate-800">Entrega #{e.numero}</h2>
          <span className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_META[e.status].cls}`}>{STATUS_META[e.status].label}</span>
          {(e.tentativas ?? 1) > 1 && (
            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">♻ {e.tentativas}ª tentativa</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <a href={`/entregas/etiquetas/entrega/${e.id}`} target="_blank" rel="noopener"
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50">
            <Printer className="h-3.5 w-3.5" /> Etiqueta
          </a>
          {e.status === 'NAO_ENTREGUE' && (
            <button onClick={() => void novaTentativa()} disabled={busy}
              className="rounded-lg border border-amber-400 px-3 py-1.5 text-sm font-medium text-amber-700 hover:bg-amber-50 disabled:opacity-50">
              ♻ Nova tentativa
            </button>
          )}
          {editavel && (
            <>
              <button onClick={() => setConfirmacao({
                  titulo: 'Cancelar entrega',
                  mensagem: `Cancelar a entrega #${e.numero} (${e.destinatarioNome})? Ela sai da fila de montagem.`,
                  acao: cancelar,
                })} disabled={busy}
                className="rounded-lg border border-rose-300 px-3 py-1.5 text-sm font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-50">
                Cancelar entrega
              </button>
              <button onClick={() => navigate(`/entregas/${e.id}/editar`)}
                className="flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-700">
                <Pencil className="h-3.5 w-3.5" /> Editar
              </button>
            </>
          )}
        </div>
      </div>

      {msg && <div className={`rounded-lg px-4 py-2 text-sm ${msg.tipo === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{msg.texto}</div>}
      {e.status === 'PENDENTE' && e.viagemNumero != null && (
        <div className="rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-800">
          Esta entrega está na viagem #{e.viagemNumero} (em montagem) — remova-a da viagem para editar ou cancelar.
        </div>
      )}

      {/* Destinatário */}
      <div className={card}>
        <h3 className="mb-3 text-sm font-semibold text-slate-700">Destinatário</h3>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div><span className={lbl}>Nome</span><div className="text-slate-700">{e.destinatarioNome}</div></div>
          <div><span className={lbl}>Telefone</span>
            <div className="text-slate-700">{e.telefone
              ? <a className="inline-flex items-center gap-1 text-sky-700 hover:underline" href={`tel:${e.telefone}`}><Phone className="h-3 w-3" />{maskTelefone(e.telefone)}</a>
              : '—'}</div></div>
          <div><span className={lbl}>Tipo</span><div className="text-slate-700">{TIPO_LABEL[e.tipoCliente] ?? e.tipoCliente}</div></div>
          <div><span className={lbl}>Matrícula</span><div className="text-slate-700">{e.matricula ?? '—'}</div></div>
        </div>
      </div>

      {/* Endereço */}
      <div className={card}>
        <h3 className="mb-3 text-sm font-semibold text-slate-700">Endereço de entrega</h3>
        <div className="text-sm text-slate-700">
          {e.endLogradouro}{e.endNumero ? `, ${e.endNumero}` : ''}{e.endComplemento ? ` (${e.endComplemento})` : ''}
          {e.endBairro ? ` — ${e.endBairro}` : ''}
        </div>
        <div className="text-sm text-slate-500">{e.endCidade}/{e.endUf}{e.endCep ? ` · CEP ${maskCep(e.endCep)}` : ''}</div>
        {e.endReferencia && <div className="mt-1 text-xs text-slate-500">Ref.: {e.endReferencia}</div>}
      </div>

      {/* Venda / carga */}
      <div className={card}>
        <h3 className="mb-3 text-sm font-semibold text-slate-700">Venda e carga</h3>
        <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div><span className={lbl}>Volumes</span><div className="text-slate-700">{e.quantidadeVolumes}</div></div>
          <div><span className={lbl}>Origem da venda</span><div className="text-slate-700">{e.origemVenda ? ORIGEM_LABEL[e.origemVenda] : '—'}</div></div>
          <div><span className={lbl}>Horário preferido</span><div className="text-slate-700">{e.horario ?? '—'}</div></div>
          <div><span className={lbl}>Criada em</span><div className="text-slate-700">{new Date(e.criadoEm).toLocaleString('pt-BR')}</div></div>
          {e.observacoes && <div className="col-span-2 sm:col-span-4"><span className={lbl}>Observações</span><div className="text-slate-700">{e.observacoes}</div></div>}
        </div>
        <div className="mt-3 border-t border-slate-100 pt-3">
          <span className={lbl}>Cupons / Notas</span>
          {e.cupons.length === 0 ? <div className="text-sm text-slate-500">—</div> : (
            <ul className="mt-1 space-y-0.5 text-sm">
              {e.cupons.map((c, i) => (
                <li key={i} className="text-slate-700">{c.numeroCupom || 's/ nº'}{c.valor != null ? ` · R$ ${Number(c.valor).toFixed(2)}` : ''}</li>
              ))}
            </ul>
          )}
          {e.totalCupons > 0 && <div className="mt-1 text-sm text-slate-600">Total: <strong>R$ {Number(e.totalCupons).toFixed(2)}</strong></div>}
        </div>
      </div>

      {/* Viagem / baixa */}
      {(e.viagemNumero != null || e.dataHoraEntrega || e.motivoNaoEntrega || e.motivoCancelamento || (e.historicoTentativas?.length ?? 0) > 0) && (
        <div className={card}>
          <h3 className="mb-3 text-sm font-semibold text-slate-700">Rota e baixa</h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            {e.viagemNumero != null && (
              <div><span className={lbl}>Viagem</span>
                <div className="text-slate-700">
                  <Link to="/viagens" className="text-sky-700 hover:underline">#{e.viagemNumero}</Link>
                  {e.viagemSituacao ? ` · ${e.viagemSituacao}` : ''}
                </div></div>
            )}
            {e.dataHoraEntrega && <div><span className={lbl}>Baixada em</span><div className="text-slate-700">{new Date(e.dataHoraEntrega).toLocaleString('pt-BR')}</div></div>}
            {e.motivoNaoEntrega && <div className="col-span-2"><span className={lbl}>Motivo da não-entrega</span><div className="text-rose-700">{e.motivoNaoEntrega}</div></div>}
            {e.motivoCancelamento && <div className="col-span-2"><span className={lbl}>Motivo do cancelamento</span><div className="text-slate-600">{e.motivoCancelamento}</div></div>}
          </div>
          {(e.historicoTentativas?.length ?? 0) > 0 && (
            <div className="mt-3 border-t border-slate-100 pt-3">
              <span className={lbl}>Tentativas anteriores</span>
              <ul className="mt-1 space-y-0.5 text-sm">
                {e.historicoTentativas!.map((t, i) => (
                  <li key={i} className="text-slate-600">
                    {t.tentativa}ª — {t.motivo ?? 'sem motivo'}
                    {t.viagemNumero ? ` · viagem #${t.viagemNumero}` : ''}
                    {t.dataHora ? ` · ${new Date(t.dataHora).toLocaleString('pt-BR')}` : ''}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        open={!!confirmacao}
        titulo={confirmacao?.titulo ?? ''}
        mensagem={confirmacao?.mensagem ?? ''}
        perigo
        busy={busy}
        onConfirm={() => { void confirmacao?.acao().then(() => setConfirmacao(null)); }}
        onCancel={() => setConfirmacao(null)}
      />
    </div>
  );
}
