import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowDown, ArrowLeft, ArrowUp, Camera, CheckCircle2, FileText, Loader2, Phone, Plus, Printer, Send, Sparkles, Trash2,
} from 'lucide-react';
import { logisticaApi } from '../services/api';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { BaixaDialog } from '../components/BaixaDialog';
import { useToast } from '../components/Toast';
import { maskTelefone } from '../utils/format';

// Detalhe da viagem (padrão workspace): paradas na ordem da rota + ações por
// situação (despachar/concluir/descartar, baixa por parada, romaneio/etiquetas).

interface ParadaDet {
  id: string; sequencia: number;
  entrega?: {
    id: string; numero: number; destinatarioNome: string; telefone?: string | null;
    endLogradouro: string; endNumero?: string | null; endBairro?: string | null; endCidade?: string | null;
    quantidadeVolumes: number; status: string; temComprovante?: boolean;
    criadoEm?: string; dataHoraEntrega?: string | null;
    baixadoPorNome?: string | null; recebedorNome?: string | null;
    motivoNaoEntrega?: string | null;
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

const dh = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';

const SIT_META: Record<string, { label: string; cls: string }> = {
  RASCUNHO: { label: 'Em preparação', cls: 'bg-sky-100 text-sky-700' },
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
  const { toast } = useToast();
  const [naoEncontrada, setNaoEncontrada] = useState(false);
  const [confirmacao, setConfirmacao] = useState<{ titulo: string; mensagem: string; acao: () => Promise<void> } | null>(null);
  const [baixaAlvo, setBaixaAlvo] = useState<{ id: string; numero: number; destinatarioNome: string } | null>(null);
  // Edição de RASCUNHO (12/06): veículo/motorista, adicionar entregas, reordenar.
  const [veiculos, setVeiculos] = useState<{ id: string; placa: string; modelo?: string | null }[]>([]);
  const [motoristas, setMotoristas] = useState<CoreItem[]>([]);
  const [pendentesAdd, setPendentesAdd] = useState<EntregaPend[]>([]);
  const [buscaFila, setBuscaFila] = useState('');
  // Seleção local de veículo/motorista — salva no botão SALVAR (pedido 12/06).
  const [veiculoSel, setVeiculoSel] = useState('');
  const [motoristaSel, setMotoristaSel] = useState('');
  const [salvandoVm, setSalvandoVm] = useState(false);
  const [bairrosSel, setBairrosSel] = useState<string[]>([]);
  const [sugerindo, setSugerindo] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const { data } = await logisticaApi.get<Viagem>(`/viagens/${id}`);
      setV(data);
    } catch {
      setNaoEncontrada(true);
    } finally { setLoading(false); }
  }, [id]);
  useEffect(() => { void carregar(); }, [carregar]);
  useEffect(() => {
    setVeiculoSel(v?.veiculoId ?? '');
    setMotoristaSel(v?.motoristaId ?? '');
  }, [v?.veiculoId, v?.motoristaId]);

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

  // Salvar explícito (botão) de veículo + motorista do rascunho.
  const vmAlterado = veiculoSel !== (v?.veiculoId ?? '') || motoristaSel !== (v?.motoristaId ?? '');
  async function salvarVeiculoMotorista() {
    setSalvandoVm(true);
    try {
      await logisticaApi.patch(`/viagens/${id}`, {
        veiculoId: veiculoSel || undefined,
        motoristaId: motoristaSel || undefined,
      });
      await carregar();
      toast('success', 'Veículo e motorista salvos.');
    } catch (err) {
      const m = (err as { response?: { data?: { message?: string } } }).response?.data?.message;
      toast('error', Array.isArray(m) ? m.join(', ') : m || 'Falha ao salvar.');
    } finally { setSalvandoVm(false); }
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
    try {
      const { data } = await logisticaApi.post<{ ordem: string[]; semCoordenada: string[]; geocodificadas: number; distanciaKm: number | null; fonteDistancia?: 'OSRM' | 'HAVERSINE' }>(
        '/viagens/sugerir-ordem', { filialId: v?.filialId, entregaIds: ordem });
      await aplicarOrdem(data.ordem);
      const aviso = data.semCoordenada.length ? ` ${data.semCoordenada.length} sem localização foram pro fim.` : '';
      const via = data.fonteDistancia === 'OSRM' ? ' por rua' : data.distanciaKm != null ? ' em linha reta' : '';
      toast('success', `Ordem recalculada (${data.geocodificadas} localizadas${data.distanciaKm != null ? `, ~${data.distanciaKm} km${via}` : ''}).${aviso}`);
    } catch (err) {
      const m = (err as { response?: { data?: { message?: string } } }).response?.data?.message;
      toast('error', Array.isArray(m) ? m.join(', ') : m || 'Falha ao recalcular.');
    } finally { setSugerindo(false); }
  }

  const SEM_BAIRRO = '__SEM__';
  const keyBairro = (b?: string | null) => (b ?? '').trim().toUpperCase() || SEM_BAIRRO;

  const adicionarEntrega = (entregaId: string) =>
    acao(async () => {
      await logisticaApi.post(`/viagens/${id}/entregas`, { entregaIds: [entregaId] });
      setPendentesAdd((p) => p.filter((e) => e.id !== entregaId));
    }, 'Falha ao adicionar entrega.');

  async function acao(fn: () => Promise<unknown>, erro: string) {
    setBusy(true);
    try { await fn(); await carregar(); }
    catch (err) {
      const m = (err as { response?: { data?: { message?: string } } }).response?.data?.message;
      toast('error', Array.isArray(m) ? m.join(', ') : m || erro);
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
      toast('error', Array.isArray(m) ? m.join(', ') : m || 'Falha ao descartar.');
      setBusy(false);
    }
  }

  if (loading) return <div className="p-6 text-sm text-slate-500"><Loader2 className="inline h-4 w-4 animate-spin" /> Carregando…</div>;
  if (!v) return (
    <div className="space-y-4">
      {naoEncontrada && <div className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">Viagem não encontrada.</div>}
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
    <div className="space-y-4">
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


      {ehRascunho && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          {(!v.veiculoId || !v.motoristaId) && (
            <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Viagem salva sem {!v.veiculoId && !v.motoristaId ? 'veículo e motorista' : !v.veiculoId ? 'veículo' : 'motorista'} — defina e salve para poder despachar.
            </p>
          )}
          <div className="grid grid-cols-2 items-end gap-3 lg:grid-cols-12">
            <div className="lg:col-span-4">
              <label className="block text-xs font-medium text-slate-500">Veículo (disponível)</label>
              <select value={veiculoSel} disabled={salvandoVm} onChange={(e) => setVeiculoSel(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none">
                <option value="">—</option>
                {v.veiculoId && !veiculos.some((x) => x.id === v.veiculoId) && (
                  <option value={v.veiculoId}>{v.veiculo?.placa ?? 'atual'}</option>
                )}
                {veiculos.map((x) => <option key={x.id} value={x.id}>{x.placa}{x.modelo ? ` · ${x.modelo}` : ''}</option>)}
              </select>
            </div>
            <div className="lg:col-span-4">
              <label className="block text-xs font-medium text-slate-500">Motorista</label>
              <select value={motoristaSel} disabled={salvandoVm} onChange={(e) => setMotoristaSel(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none">
                <option value="">—</option>
                {motoristas.map((x) => <option key={x.id} value={x.id}>{labelCore(x)}</option>)}
              </select>
            </div>
            <div className="lg:col-span-1">
              <span className="block text-xs font-medium text-slate-500">Paradas</span>
              <div className="py-2 text-sm text-slate-700">{v.paradas.length}</div>
            </div>
            <div className="lg:col-span-1">
              <span className="block text-xs font-medium text-slate-500">Volumes</span>
              <div className="py-2 text-sm text-slate-700">{volumes}</div>
            </div>
            <div className="lg:col-span-2">
              <button onClick={() => void salvarVeiculoMotorista()} disabled={salvandoVm || !vmAlterado}
                title={!vmAlterado ? 'Nada alterado para salvar' : undefined}
                className="w-full rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50">
                {salvandoVm ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
      {!ehRascunho && (
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div><span className="block text-xs font-medium text-slate-500">Veículo</span>
            <div className="text-slate-700">{v.veiculo?.placa ?? '—'}{v.veiculo?.modelo ? ` · ${v.veiculo.modelo}` : ''}</div></div>
          <div><span className="block text-xs font-medium text-slate-500">Motorista</span>
            <div className="text-slate-700">{v.motoristaNome ?? '—'}</div></div>
          <div><span className="block text-xs font-medium text-slate-500">Paradas</span>
            <div className="text-slate-700">{v.paradas.length}</div></div>
          <div><span className="block text-xs font-medium text-slate-500">Volumes</span>
            <div className="text-slate-700">{volumes}</div></div>
        </div>
      </div>
      )}

      <div className={ehRascunho ? 'grid grid-cols-1 items-start gap-6 lg:grid-cols-2' : ''}>
      {ehRascunho && (() => {
        const bairros = (() => {
          const m = new Map<string, { label: string; count: number }>();
          for (const e of pendentesFora) {
            const k = keyBairro(e.endBairro);
            const label = (e.endBairro ?? '').trim() || 'Sem bairro';
            const cur = m.get(k);
            if (cur) cur.count++; else m.set(k, { label, count: 1 });
          }
          return [...m.entries()].map(([key, val]) => ({ key, ...val }))
            .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
        })();
        const q = buscaFila.trim().toLowerCase();
        const filaFiltrada = pendentesFora.filter((e) => {
          if (bairrosSel.length > 0 && !bairrosSel.includes(keyBairro(e.endBairro))) return false;
          if (q && !(`#${e.numero} ${e.destinatarioNome} ${e.endLogradouro} ${e.endBairro ?? ''}`.toLowerCase().includes(q))) return false;
          return true;
        });
        const adicionarTodas = () =>
          acao(async () => {
            await logisticaApi.post(`/viagens/${id}/entregas`, { entregaIds: filaFiltrada.map((e) => e.id) });
            setPendentesAdd((p) => p.filter((e) => !filaFiltrada.some((f) => f.id === e.id)));
          }, 'Falha ao adicionar entregas.');
        return (
        <div className="rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-700">
            <span>Fila de pendentes ({filaFiltrada.length})</span>
            {filaFiltrada.length > 0 && (
              <button onClick={() => void adicionarTodas()} disabled={busy} className="text-xs font-medium text-sky-700 hover:underline">
                + Adicionar {bairrosSel.length > 0 || q ? 'as filtradas' : 'todas'} ({filaFiltrada.length})
              </button>
            )}
          </div>
          <div className="space-y-2 border-b border-slate-100 px-4 py-2.5">
            <input value={buscaFila} onChange={(e) => setBuscaFila(e.target.value)} placeholder="Buscar por nome, rua, bairro ou nº…"
              className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-sky-500 focus:outline-none" />
            {bairros.length > 1 && (
              <div className="flex flex-wrap gap-1.5">
                <button onClick={() => setBairrosSel([])}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${bairrosSel.length === 0 ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                  Todos
                </button>
                {bairros.map((b) => (
                  <button key={b.key} onClick={() => setBairrosSel((p) => (p.includes(b.key) ? p.filter((x) => x !== b.key) : [...p, b.key]))}
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${bairrosSel.includes(b.key) ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                    {b.label} ({b.count})
                  </button>
                ))}
              </div>
            )}
          </div>
          {filaFiltrada.length === 0 ? (
            <div className="p-4 text-sm text-slate-500">{pendentesFora.length === 0 ? 'Nenhuma entrega pendente fora desta viagem.' : 'Tudo que casa com o filtro já está na rota.'}</div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {filaFiltrada.map((e) => (
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
          )}
        </div>
        );
      })()}
      <div className="space-y-4">
      {/* Paradas na ordem da rota */}
      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-700">
          <span>Rota ({v.paradas.length} paradas · {volumes} vol)</span>
          {ehRascunho && v.paradas.length >= 2 && (
            <button onClick={() => void sugerirOrdemRascunho()} disabled={busy || sugerindo}
              title="Recalcula o melhor percurso a partir da filial"
              className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300">
              {sugerindo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {sugerindo ? 'Recalculando…' : 'Sugerir melhor rota'}
            </button>
          )}
        </div>
        {v.paradas.length === 0 ? (
          <div className="p-6 text-sm text-slate-500">Sem entregas nesta viagem.</div>
        ) : !ehRascunho ? (
          /* Execução (em curso/concluída): GRID — uma entrega por linha,
             ação no fim (pedido Clenio 12/06). */
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-3 py-2.5 w-10">#</th>
                <th className="px-3 py-2.5">Entrega</th>
                <th className="px-3 py-2.5">Endereço</th>
                <th className="px-3 py-2.5">Telefone</th>
                <th className="px-3 py-2.5 text-right">Vol.</th>
                <th className="px-3 py-2.5">Lançada</th>
                <th className="px-3 py-2.5">Entrega</th>
                <th className="px-3 py-2.5 text-right">Situação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {[...v.paradas].sort((a, b) => a.sequencia - b.sequencia).map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2 text-slate-500">{p.sequencia}</td>
                  {p.entrega ? (
                    <>
                      <td className="px-3 py-2 font-medium text-slate-700">
                        <Link to={`/entregas/${p.entrega.id}`} className="hover:text-sky-700 hover:underline">
                          #{p.entrega.numero} · {p.entrega.destinatarioNome}
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-slate-500">
                        {p.entrega.endLogradouro}{p.entrega.endNumero ? `, ${p.entrega.endNumero}` : ''}{p.entrega.endBairro ? ` — ${p.entrega.endBairro}` : ''}
                      </td>
                      <td className="px-3 py-2">
                        {p.entrega.telefone ? (
                          <a href={`tel:${p.entrega.telefone}`} className="inline-flex items-center gap-1 text-sky-700 hover:underline">
                            <Phone className="h-3 w-3" /> {maskTelefone(p.entrega.telefone)}
                          </a>
                        ) : <span className="text-slate-400">—</span>}
                      </td>
                      <td className="px-3 py-2 text-right text-slate-600">{p.entrega.quantidadeVolumes}</td>
                      <td className="px-3 py-2 text-slate-500" title="Hora do lançamento da entrega (compra no balcão)">{dh(p.entrega.criadoEm)}</td>
                      <td className="px-3 py-2">
                        {p.entrega.dataHoraEntrega ? (
                          <div className="text-xs leading-snug">
                            <div className="font-medium text-slate-700">{dh(p.entrega.dataHoraEntrega)}</div>
                            {p.entrega.baixadoPorNome && <div className="text-slate-500">por {p.entrega.baixadoPorNome}</div>}
                            {p.entrega.recebedorNome && <div className="text-slate-500">recebeu: {p.entrega.recebedorNome}</div>}
                            {p.entrega.motivoNaoEntrega && <div className="text-rose-600">{p.entrega.motivoNaoEntrega}</div>}
                          </div>
                        ) : <span className="text-slate-400">—</span>}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {v.situacao === 'EM_CURSO' && p.entrega.status === 'EM_VIAGEM' ? (
                          <button onClick={() => setBaixaAlvo({ id: p.entrega!.id, numero: p.entrega!.numero, destinatarioNome: p.entrega!.destinatarioNome })}
                            disabled={busy} title="Dar baixa (prova de entrega)"
                            className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50">
                            <Camera className="h-3.5 w-3.5" /> Baixa
                          </button>
                        ) : p.entrega.status === 'ENTREGUE' ? (
                          <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[11px] font-medium text-emerald-700"
                            title={p.entrega.temComprovante ? 'Com comprovante' : 'Sem comprovante'}>
                            ✓ Entregue{p.entrega.temComprovante ? ' 📎' : ''}
                          </span>
                        ) : p.entrega.status === 'NAO_ENTREGUE' ? (
                          <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[11px] font-medium text-rose-700">✗ Não entregue</span>
                        ) : (
                          <span className="text-xs text-slate-400">{p.entrega.status}</span>
                        )}
                      </td>
                    </>
                  ) : (
                    <td colSpan={7} className="px-3 py-2 text-xs text-slate-500">{p.local ?? 'Parada sem entrega'}{p.observacao ? ` — ${p.observacao}` : ''}</td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          </div>
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


      </div>

      </div>

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
            toast('success', `Baixa registrada para a entrega #${baixaAlvo.numero}.`);
            await carregar();
          }}
        />
      )}
    </div>
  );
}
