import { useEffect, useState } from 'react';
import { Loader2, Truck, Send, Trash2, Printer, CheckCircle2, FileText } from 'lucide-react';
import { coreApi, logisticaApi } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

interface CoreItem { id: string; nome?: string; codigo?: string; nomeFantasia?: string }
interface Veiculo { id: string; placa: string; modelo?: string | null; situacao: string }
interface Entrega { id: string; numero: number; destinatarioNome: string; endLogradouro: string; endBairro?: string | null; quantidadeVolumes: number }
interface Viagem {
  id: string; numero: number; situacao: string;
  veiculo?: { placa: string } | null; _count?: { paradas: number };
  motoristaNome?: string | null;
}
interface ParadaDet {
  id: string; sequencia: number;
  entrega?: { id: string; numero: number; destinatarioNome: string; endLogradouro: string; endNumero?: string | null; endBairro?: string | null; endCidade?: string | null; quantidadeVolumes: number } | null;
}
interface ViagemDet { id: string; numero: number; situacao: string; paradas: ParadaDet[] }

const labelCore = (i: CoreItem) => i.nomeFantasia || i.nome || i.codigo || i.id.slice(0, 8);

export function ViagensPage() {
  const { usuario } = useAuth();
  const filialId = usuario?.filialAtual?.id ?? usuario?.filiais?.[0]?.id ?? '';

  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
  const [motoristas, setMotoristas] = useState<CoreItem[]>([]);
  const [pendentes, setPendentes] = useState<Entrega[]>([]);
  const [viagens, setViagens] = useState<Viagem[]>([]);
  const [loading, setLoading] = useState(true);

  const [veiculoId, setVeiculoId] = useState('');
  const [motoristaId, setMotoristaId] = useState('');
  const [selecao, setSelecao] = useState<string[]>([]); // ordem = ordem de clique
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [detalhe, setDetalhe] = useState<ViagemDet | null>(null); // viagem expandida (ver entregas)

  async function carregar() {
    setLoading(true);
    try {
      const [v, u, e, vg] = await Promise.all([
        logisticaApi.get<Veiculo[]>('/veiculos', { params: filialId ? { filialId, situacao: 'DISPONIVEL' } : { situacao: 'DISPONIVEL' } }),
        coreApi.get<CoreItem[]>('/usuarios').catch(() => ({ data: [] })),
        logisticaApi.get<Entrega[]>('/entregas', { params: filialId ? { filialId } : undefined }),
        logisticaApi.get<Viagem[]>('/viagens', { params: filialId ? { filialId } : undefined }),
      ]);
      setVeiculos(v.data); setMotoristas(u.data); setPendentes(e.data); setViagens(vg.data);
    } finally { setLoading(false); }
  }
  useEffect(() => { void carregar(); }, [filialId]);

  function toggle(id: string) {
    setSelecao((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  }

  async function montar() {
    setMsg(null);
    if (!veiculoId || !motoristaId) { setMsg({ tipo: 'erro', texto: 'Escolha veículo e motorista.' }); return; }
    if (selecao.length === 0) { setMsg({ tipo: 'erro', texto: 'Selecione ao menos uma entrega.' }); return; }
    setBusy(true);
    try {
      const { data } = await logisticaApi.post('/viagens', { filialId, veiculoId, motoristaId, entregaIds: selecao });
      setMsg({ tipo: 'ok', texto: `Viagem nº ${data.numero} montada (${selecao.length} paradas). Despache quando carregar.` });
      setSelecao([]);
      void carregar();
    } catch (err) {
      const m = (err as { response?: { data?: { message?: string } } }).response?.data?.message;
      setMsg({ tipo: 'erro', texto: Array.isArray(m) ? m.join(', ') : m || 'Falha ao montar viagem.' });
    } finally { setBusy(false); }
  }

  async function despachar(id: string) {
    setBusy(true);
    try { await logisticaApi.post(`/viagens/${id}/despachar`, {}); void carregar(); }
    catch (err) {
      const m = (err as { response?: { data?: { message?: string } } }).response?.data?.message;
      setMsg({ tipo: 'erro', texto: Array.isArray(m) ? m.join(', ') : m || 'Falha ao despachar.' });
    } finally { setBusy(false); }
  }

  async function concluir(id: string) {
    setBusy(true);
    try {
      await logisticaApi.post(`/viagens/${id}/concluir`, {});
      setMsg({ tipo: 'ok', texto: 'Viagem concluída — veículo liberado e entregas baixadas.' });
      void carregar();
    } catch (err) {
      const m = (err as { response?: { data?: { message?: string } } }).response?.data?.message;
      setMsg({ tipo: 'erro', texto: Array.isArray(m) ? m.join(', ') : m || 'Falha ao concluir.' });
    } finally { setBusy(false); }
  }
  async function verDetalhe(id: string) {
    if (detalhe?.id === id) { setDetalhe(null); return; } // toggle (recolhe)
    try { const { data } = await logisticaApi.get<ViagemDet>(`/viagens/${id}`); setDetalhe(data); }
    catch { setMsg({ tipo: 'erro', texto: 'Falha ao carregar as entregas da viagem.' }); }
  }

  async function removerEntrega(viagemId: string, entregaId: string) {
    setBusy(true);
    try {
      const { data } = await logisticaApi.delete<ViagemDet>(`/viagens/${viagemId}/entregas/${entregaId}`);
      setDetalhe(data);
      void carregar();
    } catch (err) {
      const m = (err as { response?: { data?: { message?: string } } }).response?.data?.message;
      setMsg({ tipo: 'erro', texto: Array.isArray(m) ? m.join(', ') : m || 'Falha ao remover entrega.' });
    } finally { setBusy(false); }
  }

  async function descartar(id: string) {
    setBusy(true);
    try { await logisticaApi.delete(`/viagens/${id}`); void carregar(); } finally { setBusy(false); }
  }

  const sel = 'rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-800">Montagem de viagem</h2>
        <p className="text-sm text-slate-500">Selecione veículo, motorista e as entregas (na ordem da rota). Despache ao carregar.</p>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <div>
          <label className="block text-xs font-medium text-slate-500">Veículo (disponível) *</label>
          <select value={veiculoId} onChange={(e) => setVeiculoId(e.target.value)} className={`mt-1 ${sel}`}>
            <option value="">—</option>
            {veiculos.map((v) => <option key={v.id} value={v.id}>{v.placa} {v.modelo ? `· ${v.modelo}` : ''}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500">Motorista *</label>
          <select value={motoristaId} onChange={(e) => setMotoristaId(e.target.value)} className={`mt-1 ${sel}`}>
            <option value="">—</option>
            {motoristas.map((u) => <option key={u.id} value={u.id}>{labelCore(u)}</option>)}
          </select>
        </div>
        <button onClick={montar} disabled={busy}
          className="flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50">
          <Truck className="h-4 w-4" /> Montar viagem ({selecao.length})
        </button>
      </div>

      {msg && <div className={`rounded-lg px-4 py-2 text-sm ${msg.tipo === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{msg.texto}</div>}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Pendentes */}
        <div className="rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-700">Pendentes ({pendentes.length})</div>
          {loading ? <div className="p-6 text-sm text-slate-500"><Loader2 className="inline h-4 w-4 animate-spin" /> Carregando…</div>
            : pendentes.length === 0 ? <div className="p-6 text-sm text-slate-500">Nenhuma entrega pendente.</div>
            : <ul className="divide-y divide-slate-100 max-h-[420px] overflow-auto">
                {pendentes.map((e) => {
                  const idx = selecao.indexOf(e.id);
                  return (
                    <li key={e.id} className="flex items-center gap-3 px-4 py-2 text-sm hover:bg-slate-50">
                      <button onClick={() => toggle(e.id)}
                        className={`flex h-6 w-6 items-center justify-center rounded-full border text-xs font-semibold ${idx >= 0 ? 'border-sky-500 bg-sky-500 text-white' : 'border-slate-300 text-slate-400'}`}>
                        {idx >= 0 ? idx + 1 : ''}
                      </button>
                      <div className="flex-1">
                        <div className="font-medium text-slate-700">#{e.numero} · {e.destinatarioNome}</div>
                        <div className="text-xs text-slate-500">{e.endLogradouro} — {e.endBairro} · {e.quantidadeVolumes} vol</div>
                      </div>
                      <a href={`/entregas/etiquetas/entrega/${e.id}`} target="_blank" rel="noopener" title="Etiqueta"
                        className="text-slate-300 hover:text-sky-600"><Printer className="h-4 w-4" /></a>
                    </li>
                  );
                })}
              </ul>}
        </div>

        {/* Viagens */}
        <div className="rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-700">Viagens</div>
          {viagens.length === 0 ? <div className="p-6 text-sm text-slate-500">Nenhuma viagem.</div>
            : <ul className="divide-y divide-slate-100 max-h-[420px] overflow-auto">
                {viagens.map((v) => (
                  <li key={v.id} className="px-4 py-2 text-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-slate-700">Viagem #{v.numero} · {v.veiculo?.placa}{v.motoristaNome ? ` · ${v.motoristaNome}` : ''}</div>
                        <div className="text-xs text-slate-500">
                          <span className={`rounded px-1.5 py-0.5 ${v.situacao === 'EM_CURSO' ? 'bg-amber-100 text-amber-700' : v.situacao === 'CONCLUIDA' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{v.situacao}</span>
                          {' '}·{' '}
                          <button type="button" onClick={() => verDetalhe(v.id)} className="font-medium text-sky-700 underline-offset-2 hover:underline">
                            {v._count?.paradas ?? 0} entregas {detalhe?.id === v.id ? '▲' : '▼'}
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <a href={`/entregas/romaneio/viagem/${v.id}`} target="_blank" rel="noopener" title="Romaneio (relatório da viagem)"
                          className="flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"><FileText className="h-3.5 w-3.5" /> Romaneio</a>
                        {(v.situacao === 'RASCUNHO' || v.situacao === 'EM_CURSO') && (
                          <a href={`/entregas/etiquetas/viagem/${v.id}`} target="_blank" rel="noopener" title="Imprimir etiquetas"
                            className="flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"><Printer className="h-3.5 w-3.5" /> Etiquetas</a>
                        )}
                        {v.situacao === 'RASCUNHO' && (
                          <>
                            <button onClick={() => despachar(v.id)} disabled={busy} title="Despachar"
                              className="flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"><Send className="h-3.5 w-3.5" /> Despachar</button>
                            <button onClick={() => descartar(v.id)} disabled={busy} title="Descartar"
                              className="text-slate-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                          </>
                        )}
                        {v.situacao === 'EM_CURSO' && (
                          <button onClick={() => concluir(v.id)} disabled={busy} title="Concluir viagem (baixa manual — libera veículo e baixa entregas)"
                            className="flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"><CheckCircle2 className="h-3.5 w-3.5" /> Concluir</button>
                        )}
                      </div>
                    </div>

                    {detalhe?.id === v.id && (
                      <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
                        {detalhe.paradas.length === 0 ? (
                          <div className="px-1 text-xs text-slate-500">Sem entregas nesta viagem.</div>
                        ) : (
                          <ul className="space-y-1">
                            {detalhe.paradas.map((p) => (
                              <li key={p.id} className="flex items-center justify-between gap-2 rounded bg-white px-2 py-1.5 text-xs">
                                <div className="min-w-0">
                                  <div className="font-medium text-slate-700">{p.sequencia}. #{p.entrega?.numero} · {p.entrega?.destinatarioNome}</div>
                                  <div className="truncate text-slate-500">
                                    {p.entrega?.endLogradouro}{p.entrega?.endNumero ? `, ${p.entrega.endNumero}` : ''}{p.entrega?.endBairro ? ` — ${p.entrega.endBairro}` : ''} · {p.entrega?.quantidadeVolumes} vol
                                  </div>
                                </div>
                                {v.situacao === 'RASCUNHO' && p.entrega && (
                                  <button onClick={() => removerEntrega(v.id, p.entrega!.id)} disabled={busy} title="Remover da viagem"
                                    className="shrink-0 text-slate-400 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
                                )}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>}
        </div>
      </div>
    </div>
  );
}
