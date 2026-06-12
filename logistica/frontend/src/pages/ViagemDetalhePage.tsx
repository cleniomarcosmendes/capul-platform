import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowDown, ArrowLeft, ArrowUp, Camera, CheckCircle2, FileText, Loader2, Phone, Plus, Printer, Send, Trash2,
} from 'lucide-react';
import { logisticaApi } from '../services/api';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { BaixaDialog } from '../components/BaixaDialog';
import { maskTelefone } from '../utils/format';

// Detalhe da viagem (padrão workspace): paradas na ordem da rota + ações por
// situação (despachar/concluir/descartar, baixa por parada, romaneio/etiquetas).

interface ParadaDet {
  id: string; sequencia: number;
  entrega?: {
    id: string; numero: number; destinatarioNome: string; telefone?: string | null;
    endLogradouro: string; endNumero?: string | null; endBairro?: string | null; endCidade?: string | null;
    quantidadeVolumes: number; status: string; temComprovante?: boolean;
  } | null;
  local?: string | null; observacao?: string | null;
}
interface Viagem {
  id: string; numero: number; situacao: string; criadoEm?: string; filialId?: string;
  veiculoId?: string | null; motoristaId?: string | null;
  veiculo?: { placa: string; modelo?: string | null } | null;
  motoristaNome?: string | null;
  paradas: ParadaDet[];
}
interface CoreItem { id: string; nome?: string; codigo?: string; nomeFantasia?: string }
interface EntregaPend {
  id: string; numero: number; destinatarioNome: string;
  endLogradouro: string; endNumero?: string | null; endBairro?: string | null;
  quantidadeVolumes: number; geocodificavel?: boolean | null; tentativas?: number;
}
const labelCore = (i: CoreItem) => i.nomeFantasia || i.nome || i.codigo || i.id.slice(0, 8);

const SIT_META: Record<string, { label: string; cls: string }> = {
  RASCUNHO: { label: 'Rascunho (em montagem)', cls: 'bg-sky-100 text-sky-700' },
  EM_CURSO: { label: 'Em curso', cls: 'bg-amber-100 text-amber-700' },
  CONCLUIDA: { label: 'Concluída', cls: 'bg-emerald-100 text-emerald-700' },
  CANCELADA: { label: 'Cancelada', cls: 'bg-slate-100 text-slate-500' },
};

export function ViagemDetalhePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [v, setV] = useState<Viagem | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);
  const [confirmacao, setConfirmacao] = useState<{ titulo: string; mensagem: string; acao: () => Promise<void> } | null>(null);
  const [baixaAlvo, setBaixaAlvo] = useState<{ id: string; numero: number; destinatarioNome: string } | null>(null);
  // Edição de RASCUNHO (12/06): veículo/motorista, adicionar entregas, reordenar.
  const [veiculos, setVeiculos] = useState<{ id: string; placa: string; modelo?: string | null }[]>([]);
  const [motoristas, setMotoristas] = useState<CoreItem[]>([]);
  const [pendentesAdd, setPendentesAdd] = useState<EntregaPend[]>([]);
  const [mostrarAdicionar, setMostrarAdicionar] = useState(false);
  const [sugerindo, setSugerindo] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const { data } = await logisticaApi.get<Viagem>(`/viagens/${id}`);
      setV(data);
    } catch {
      setMsg({ tipo: 'erro', texto: 'Viagem não encontrada.' });
    } finally { setLoading(false); }
  }, [id]);
  useEffect(() => { void carregar(); }, [carregar]);

  // Listas de apoio do RASCUNHO (veículos disponíveis, motoristas, pendentes).
  useEffect(() => {
    if (v?.situacao !== 'RASCUNHO') return;
    void (async () => {
      const [ve, mo, pe] = await Promise.all([
        logisticaApi.get('/veiculos', { params: { ...(v.filialId ? { filialId: v.filialId } : {}), situacao: 'DISPONIVEL' } }).catch(() => ({ data: [] })),
        logisticaApi.get('/motoristas', { params: v.filialId ? { filialId: v.filialId } : undefined }).catch(() => ({ data: [] })),
        logisticaApi.get('/entregas', { params: v.filialId ? { filialId: v.filialId } : undefined }).catch(() => ({ data: [] })),
      ]);
      setVeiculos(ve.data); setMotoristas(mo.data); setPendentesAdd(pe.data);
    })();
  }, [v?.situacao, v?.filialId]);

  // PATCH imediato ao trocar veículo/motorista do rascunho.
  async function definir(campo: 'veiculoId' | 'motoristaId', valor: string) {
    setBusy(true);
    setMsg(null);
    try {
      await logisticaApi.patch(`/viagens/${id}`, { [campo]: valor || undefined });
      await carregar();
    } catch (err) {
      const m = (err as { response?: { data?: { message?: string } } }).response?.data?.message;
      setMsg({ tipo: 'erro', texto: Array.isArray(m) ? m.join(', ') : m || 'Falha ao salvar.' });
    } finally { setBusy(false); }
  }

  const ordemAtual = () =>
    [...(v?.paradas ?? [])].sort((a, b) => a.sequencia - b.sequencia)
      .map((p) => p.entrega?.id).filter((x): x is string => !!x);

  async function aplicarOrdem(entregaIds: string[]) {
    await logisticaApi.patch(`/viagens/${id}/ordem`, { entregaIds });
    await carregar();
  }

  function moverParada(entregaId: string, dir: -1 | 1) {
    const ordem = ordemAtual();
    const i = ordem.indexOf(entregaId); const j = i + dir;
    if (i < 0 || j < 0 || j >= ordem.length) return;
    [ordem[i], ordem[j]] = [ordem[j], ordem[i]];
    void acao(() => aplicarOrdem(ordem), 'Falha ao reordenar.');
  }

  async function sugerirOrdemRascunho() {
    const ordem = ordemAtual();
    if (ordem.length < 2) return;
    setSugerindo(true);
    setMsg(null);
    try {
      const { data } = await logisticaApi.post<{ ordem: string[]; semCoordenada: string[]; geocodificadas: number; distanciaKm: number | null }>(
        '/viagens/sugerir-ordem', { filialId: v?.filialId, entregaIds: ordem });
      await aplicarOrdem(data.ordem);
      const aviso = data.semCoordenada.length ? ` ${data.semCoordenada.length} sem localização foram pro fim.` : '';
      setMsg({ tipo: 'ok', texto: `Ordem recalculada (${data.geocodificadas} localizadas${data.distanciaKm != null ? `, ~${data.distanciaKm} km` : ''}).${aviso}` });
    } catch (err) {
      const m = (err as { response?: { data?: { message?: string } } }).response?.data?.message;
      setMsg({ tipo: 'erro', texto: Array.isArray(m) ? m.join(', ') : m || 'Falha ao recalcular.' });
    } finally { setSugerindo(false); }
  }

  const adicionarEntrega = (entregaId: string) =>
    acao(async () => {
      await logisticaApi.post(`/viagens/${id}/entregas`, { entregaIds: [entregaId] });
      setPendentesAdd((p) => p.filter((e) => e.id !== entregaId));
    }, 'Falha ao adicionar entrega.');

  async function acao(fn: () => Promise<unknown>, erro: string) {
    setBusy(true);
    setMsg(null);
    try { await fn(); await carregar(); }
    catch (err) {
      const m = (err as { response?: { data?: { message?: string } } }).response?.data?.message;
      setMsg({ tipo: 'erro', texto: Array.isArray(m) ? m.join(', ') : m || erro });
    } finally { setBusy(false); }
  }

  const despachar = () => acao(() => logisticaApi.post(`/viagens/${id}/despachar`, {}), 'Falha ao despachar.');
  const concluir = () => acao(() => logisticaApi.post(`/viagens/${id}/concluir`, {}), 'Falha ao concluir.');
  const removerEntrega = (entregaId: string) =>
    acao(() => logisticaApi.delete(`/viagens/${id}/entregas/${entregaId}`), 'Falha ao remover entrega.');
  async function descartar() {
    setBusy(true);
    try {
      await logisticaApi.delete(`/viagens/${id}`);
      navigate('/viagens');
    } catch (err) {
      const m = (err as { response?: { data?: { message?: string } } }).response?.data?.message;
      setMsg({ tipo: 'erro', texto: Array.isArray(m) ? m.join(', ') : m || 'Falha ao descartar.' });
      setBusy(false);
    }
  }

  if (loading) return <div className="p-6 text-sm text-slate-500"><Loader2 className="inline h-4 w-4 animate-spin" /> Carregando…</div>;
  if (!v) return (
    <div className="space-y-4">
      {msg && <div className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{msg.texto}</div>}
      <Link to="/viagens" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"><ArrowLeft className="h-4 w-4" /> Voltar</Link>
    </div>
  );

  const sit = SIT_META[v.situacao] ?? { label: v.situacao, cls: 'bg-slate-100 text-slate-600' };
  const volumes = v.paradas.reduce((s, p) => s + (p.entrega?.quantidadeVolumes ?? 0), 0);
  const ehRascunho = v.situacao === 'RASCUNHO';
  const podeDespachar = !!v.veiculoId && !!v.motoristaId && v.paradas.length > 0;
  const idsNaViagem = new Set(v.paradas.map((p) => p.entrega?.id).filter(Boolean));
  const pendentesFora = pendentesAdd.filter((e) => !idsNaViagem.has(e.id));

  return (
    <div className="max-w-3xl space-y-4">
      <Link to="/viagens" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft className="h-4 w-4" /> Voltar para Viagens
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-slate-800">Viagem #{v.numero}</h2>
          <span className={`rounded px-2 py-0.5 text-xs font-medium ${sit.cls}`}>{sit.label}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a href={`/entregas/romaneio/viagem/${v.id}`} target="_blank" rel="noopener"
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50">
            <FileText className="h-3.5 w-3.5" /> Romaneio
          </a>
          {(v.situacao === 'RASCUNHO' || v.situacao === 'EM_CURSO') && (
            <a href={`/entregas/etiquetas/viagem/${v.id}`} target="_blank" rel="noopener"
              className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50">
              <Printer className="h-3.5 w-3.5" /> Etiquetas
            </a>
          )}
          {v.situacao === 'RASCUNHO' && (
            <>
              <button onClick={() => setConfirmacao({
                  titulo: 'Descartar viagem',
                  mensagem: `Descartar a viagem #${v.numero}? As entregas voltam para a fila de pendentes.`,
                  acao: descartar,
                })} disabled={busy}
                className="flex items-center gap-1.5 rounded-lg border border-rose-300 px-3 py-1.5 text-sm font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-50">
                <Trash2 className="h-3.5 w-3.5" /> Descartar
              </button>
              <button onClick={() => void despachar()} disabled={busy || !podeDespachar}
                title={!podeDespachar
                  ? 'Defina veículo, motorista e ao menos uma entrega antes de despachar'
                  : 'Carga conferida e no veículo — libera pro motorista (entregas ficam EM VIAGEM)'}
                className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50">
                <Send className="h-3.5 w-3.5" /> Despachar
              </button>
            </>
          )}
          {v.situacao === 'EM_CURSO' && (
            <button onClick={() => setConfirmacao({
                titulo: 'Concluir viagem',
                mensagem: 'Concluir manualmente? Entregas ainda EM VIAGEM serão baixadas sem prova e o veículo é liberado.',
                acao: async () => { await concluir(); },
              })} disabled={busy}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50">
              <CheckCircle2 className="h-3.5 w-3.5" /> Concluir
            </button>
          )}
        </div>
      </div>

      {msg && <div className={`rounded-lg px-4 py-2 text-sm ${msg.tipo === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{msg.texto}</div>}

      {/* Resumo */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        {ehRascunho && (!v.veiculoId || !v.motoristaId) && (
          <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Montagem salva sem {!v.veiculoId && !v.motoristaId ? 'veículo e motorista' : !v.veiculoId ? 'veículo' : 'motorista'} — defina abaixo para poder despachar.
          </p>
        )}
        <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div><span className="block text-xs font-medium text-slate-500">Veículo</span>
            {ehRascunho ? (
              <select value={v.veiculoId ?? ''} disabled={busy} onChange={(e) => void definir('veiculoId', e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:border-sky-500 focus:outline-none">
                <option value="">—</option>
                {/* mantém o veículo atual na lista mesmo que não esteja mais DISPONIVEL */}
                {v.veiculoId && !veiculos.some((x) => x.id === v.veiculoId) && (
                  <option value={v.veiculoId}>{v.veiculo?.placa ?? 'atual'}</option>
                )}
                {veiculos.map((x) => <option key={x.id} value={x.id}>{x.placa}{x.modelo ? ` · ${x.modelo}` : ''}</option>)}
              </select>
            ) : (
              <div className="text-slate-700">{v.veiculo?.placa ?? '—'}{v.veiculo?.modelo ? ` · ${v.veiculo.modelo}` : ''}</div>
            )}</div>
          <div><span className="block text-xs font-medium text-slate-500">Motorista</span>
            {ehRascunho ? (
              <select value={v.motoristaId ?? ''} disabled={busy} onChange={(e) => void definir('motoristaId', e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:border-sky-500 focus:outline-none">
                <option value="">—</option>
                {motoristas.map((x) => <option key={x.id} value={x.id}>{labelCore(x)}</option>)}
              </select>
            ) : (
              <div className="text-slate-700">{v.motoristaNome ?? '—'}</div>
            )}</div>
          <div><span className="block text-xs font-medium text-slate-500">Paradas</span>
            <div className="text-slate-700">{v.paradas.length}</div></div>
          <div><span className="block text-xs font-medium text-slate-500">Volumes</span>
            <div className="text-slate-700">{volumes}</div></div>
        </div>
      </div>

      {/* Paradas na ordem da rota */}
      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-700">
          <span>Rota ({v.paradas.length} paradas)</span>
          {ehRascunho && v.paradas.length >= 2 && (
            <button onClick={() => void sugerirOrdemRascunho()} disabled={busy || sugerindo}
              title="Geocodifica e reordena pela menor distância a partir da filial"
              className="rounded-lg border border-sky-600 px-2.5 py-1 text-xs font-medium text-sky-700 hover:bg-sky-50 disabled:opacity-50">
              {sugerindo ? 'Recalculando…' : '⇅ Recalcular ordem'}
            </button>
          )}
        </div>
        {v.paradas.length === 0 ? (
          <div className="p-6 text-sm text-slate-500">Sem entregas nesta viagem.</div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {[...v.paradas].sort((a, b) => a.sequencia - b.sequencia).map((p) => (
              <li key={p.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-700">{p.sequencia}</span>
                <div className="min-w-0 flex-1">
                  {p.entrega ? (
                    <>
                      <div className="font-medium text-slate-700">
                        <Link to={`/entregas/${p.entrega.id}`} className="hover:text-sky-700 hover:underline">
                          #{p.entrega.numero} · {p.entrega.destinatarioNome}
                        </Link>
                      </div>
                      <div className="truncate text-xs text-slate-500">
                        {p.entrega.endLogradouro}{p.entrega.endNumero ? `, ${p.entrega.endNumero}` : ''}
                        {p.entrega.endBairro ? ` — ${p.entrega.endBairro}` : ''} · {p.entrega.quantidadeVolumes} vol
                      </div>
                      {p.entrega.telefone && (
                        <a href={`tel:${p.entrega.telefone}`} className="inline-flex items-center gap-1 text-xs text-sky-700 hover:underline">
                          <Phone className="h-3 w-3" /> {maskTelefone(p.entrega.telefone)}
                        </a>
                      )}
                    </>
                  ) : (
                    <div className="text-xs text-slate-500">{p.local ?? 'Parada sem entrega'}{p.observacao ? ` — ${p.observacao}` : ''}</div>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {ehRascunho && p.entrega && (
                    <>
                      <button onClick={() => moverParada(p.entrega!.id, -1)} disabled={busy || p.sequencia === 1}
                        title="Subir" className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-sky-700 disabled:opacity-30"><ArrowUp className="h-4 w-4" /></button>
                      <button onClick={() => moverParada(p.entrega!.id, 1)} disabled={busy || p.sequencia === v.paradas.length}
                        title="Descer" className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-sky-700 disabled:opacity-30"><ArrowDown className="h-4 w-4" /></button>
                    </>
                  )}
                  {v.situacao === 'RASCUNHO' && p.entrega && (
                    <button onClick={() => setConfirmacao({
                        titulo: 'Remover entrega',
                        mensagem: `Remover a entrega #${p.entrega!.numero} (${p.entrega!.destinatarioNome}) desta viagem? Ela volta para a fila.`,
                        acao: async () => { await removerEntrega(p.entrega!.id); },
                      })} disabled={busy} title="Remover da viagem"
                      className="text-slate-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                  )}
                  {v.situacao === 'EM_CURSO' && p.entrega && p.entrega.status === 'EM_VIAGEM' && (
                    <button onClick={() => setBaixaAlvo({ id: p.entrega!.id, numero: p.entrega!.numero, destinatarioNome: p.entrega!.destinatarioNome })}
                      disabled={busy} title="Dar baixa (prova de entrega)"
                      className="flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50">
                      <Camera className="h-3.5 w-3.5" /> Baixa
                    </button>
                  )}
                  {p.entrega?.status === 'ENTREGUE' && (
                    <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[11px] font-medium text-emerald-700"
                      title={p.entrega.temComprovante ? 'Com comprovante' : 'Sem comprovante'}>
                      ✓ Entregue{p.entrega.temComprovante ? ' 📎' : ''}
                    </span>
                  )}
                  {p.entrega?.status === 'NAO_ENTREGUE' && (
                    <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[11px] font-medium text-rose-700">✗ Não entregue</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {ehRascunho && (
        <div className="rounded-xl border border-slate-200 bg-white">
          <button onClick={() => setMostrarAdicionar((x) => !x)}
            className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            <span>+ Adicionar entregas pendentes ({pendentesFora.length} na fila)</span>
            <span className="text-slate-400">{mostrarAdicionar ? '▲' : '▼'}</span>
          </button>
          {mostrarAdicionar && (
            pendentesFora.length === 0 ? (
              <div className="border-t border-slate-100 p-4 text-sm text-slate-500">Nenhuma entrega pendente fora desta viagem.</div>
            ) : (
              <ul className="max-h-72 divide-y divide-slate-100 overflow-auto border-t border-slate-100">
                {pendentesFora.map((e) => (
                  <li key={e.id} className="flex items-center gap-3 px-4 py-2 text-sm">
                    <button onClick={() => void adicionarEntrega(e.id)} disabled={busy} title="Adicionar ao fim da rota"
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-sky-500 text-sky-600 hover:bg-sky-50 disabled:opacity-50">
                      <Plus className="h-4 w-4" />
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-slate-700">#{e.numero} · {e.destinatarioNome}</div>
                      <div className="truncate text-xs text-slate-500">
                        {e.endLogradouro}{e.endNumero ? `, ${e.endNumero}` : ''} — {(e.endBairro ?? '').trim() || 'sem bairro'} · {e.quantidadeVolumes} vol
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )
          )}
        </div>
      )}

      <ConfirmDialog
        open={!!confirmacao}
        titulo={confirmacao?.titulo ?? ''}
        mensagem={confirmacao?.mensagem ?? ''}
        perigo
        busy={busy}
        onCancel={() => setConfirmacao(null)}
        onConfirm={async () => { if (confirmacao) { await confirmacao.acao(); setConfirmacao(null); } }}
      />

      {baixaAlvo && (
        <BaixaDialog
          entrega={baixaAlvo}
          onClose={() => setBaixaAlvo(null)}
          onBaixado={async () => {
            setBaixaAlvo(null);
            setMsg({ tipo: 'ok', texto: `Baixa registrada para a entrega #${baixaAlvo.numero}.` });
            await carregar();
          }}
        />
      )}
    </div>
  );
}
